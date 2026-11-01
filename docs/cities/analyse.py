"""Analysis for the cities review (docs/review-cities.md): reads the JSON files written by docs/cities/probe.js and prints the tables
of the review; with --figs DIR it also draws its figures (matplotlib). Not part of the game and not under test.

    python3 docs/cities/analyse.py /tmp/cities/small-7.json /tmp/cities/small-42.json --figs docs/img
"""
import json
import math
import sys
from collections import defaultdict

YD = 48  # days in a game year

# reference palette (dataviz skill): three categorical slots, chrome and ink, one-hue blue ramp
C = {'blue': '#2a78d6', 'orange': '#eb6834', 'aqua': '#1baf7a', 'surface': '#fcfcfb', 'ink': '#0b0b0b', 'ink2': '#52514e',
     'muted': '#898781', 'grid': '#e1e0d9', 'axis': '#c3c2b7'}
RAMP = ['#cde2fb', '#b7d3f6', '#9ec5f4', '#86b6ef', '#6da7ec', '#5598e7', '#3987e5', '#2a78d6', '#256abf', '#1c5cab', '#184f95',
        '#104281', '#0d366b']


def gini(xs):
    xs = sorted(max(0.0, x) for x in xs)
    n, s = len(xs), sum(xs)
    if n == 0 or s == 0:
        return 0.0
    return sum((2 * (i + 1) - n - 1) * x for i, x in enumerate(xs)) / (n * s)


def top_share(xs, q=0.1):
    xs = sorted((max(0.0, x) for x in xs), reverse=True)
    k = max(1, round(len(xs) * q))
    s = sum(xs)
    return sum(xs[:k]) / s if s else 0.0


def spearman(a, b):
    def ranks(v):
        order = sorted(range(len(v)), key=lambda i: v[i])
        r = [0.0] * len(v)
        i = 0
        while i < len(order):
            j = i
            while j + 1 < len(order) and v[order[j + 1]] == v[order[i]]:
                j += 1
            for k in range(i, j + 1):
                r[order[k]] = (i + j) / 2
            i = j + 1
        return r
    ra, rb = ranks(a), ranks(b)
    n = len(a)
    ma, mb = sum(ra) / n, sum(rb) / n
    cov = sum((x - ma) * (y - mb) for x, y in zip(ra, rb))
    va = math.sqrt(sum((x - ma) ** 2 for x in ra))
    vb = math.sqrt(sum((y - mb) ** 2 for y in rb))
    return cov / (va * vb) if va and vb else float('nan')


# wealth of a household in rations: the share rule's value of fields and grain (SHARES in src/sim/rules.js), plus animals at a guessed
# worth (a head of cattle 40 rations, a sheep 6); the animal worths are this review's assumption, not game values
def wealth(h):
    return h['fields'] * 120 + h['store'] * 0.5 + h['cattle'] * 40 + h['sheep'] * 6


def summarise(d):
    name = f"{d['scenario']} {d['map']} seed {d['seed']}" + (' + town' if d.get('town') else '')
    by_year = defaultdict(list)
    for h in d['households']:
        by_year[h['year']].append(h)
    rows = []
    for y in d['years']:
        hs = by_year[y['year']]
        pos = sum(max(0, h['made'] - h['need']) for h in hs)
        neg = sum(max(0, h['need'] - h['made']) for h in hs)
        cause = y['cause']
        rows.append({
            'year': y['year'], 'pop': y['pop'], 'hh': y['households'], 'villages': y['villages'], 'landless': y['landless'],
            'adults': y['adults'], 'crowded': y['crowdedAdults'], 'waited2': y['waitedTwoPlus'], 'left': y['left'], 'noLand': y['noLand'],
            'noGrain': y['noGrain'], 'births': y['births'], 'deaths': y['deaths'], 'starved': cause.get('starvation', 0) + cause.get('hunger', 0),
            'marriages': y['marriages'], 'nm45': y['neverMarried45'], 'w45': y['women45'], 'made': y['made'], 'need': y['need'],
            'spare': y['spare'], 'spoilt': y['spoilt'], 'pos': pos, 'neg': neg, 'hungryHH': sum(1 for h in hs if h['hungry'] > 0),
            'giniStore': gini([h['store'] for h in hs]), 'giniWealth': gini([wealth(h) for h in hs]), 'giniCattle': gini([h['cattle'] for h in hs]),
            'giniFields': gini([h['fields'] for h in hs]), 'top10': top_share([wealth(h) for h in hs]),
            'servants': sum(h['servants'] for h in hs), 'hhWithServants': sum(1 for h in hs if h['servants'] > 0),
            'meanSize': y['pop'] / max(1, y['households']), 'single': sum(1 for h in hs if h['members'] == 1),
            'town': (y.get('town') or {}).get('end', 0), 'townIn': (y.get('town') or {}).get('arrivals', 0),
            'townDeaths': (y.get('town') or {}).get('deaths', 0), 'townBirths': (y.get('town') or {}).get('births', 0),
            'townBought': (y.get('town') or {}).get('bought', 0), 'townNeed': (y.get('town') or {}).get('need', 0),
        })
    return name, rows, by_year


def decade_table(name, rows):
    print(f'\n## {name}')
    print('| Years | Pop. (end) | Households | Villages | Landless adults (end) | Crowded waiting (end) | Left / yr | Starved / yr | '
          'Made / need | Surplus / yr (person-yrs) | Deficit / yr | Rotted / yr | Spare stock (person-yrs, end) | Gini wealth | Top 10% |')
    print('|' + '---|' * 15)
    for a in range(0, len(rows), 10):
        ds = rows[a:a + 10]
        if not ds:
            continue
        e = ds[-1]
        m = lambda k: sum(r[k] for r in ds) / len(ds)
        print(f"| {ds[0]['year']}–{e['year']} | {e['pop']} | {e['hh']} | {e['villages']} | {e['landless']} of {e['adults']} | {e['crowded']} | "
              f"{m('left'):.1f} | {m('starved'):.1f} | {sum(r['made'] for r in ds) / sum(r['need'] for r in ds):.2f} | {m('pos') / YD:.0f} | "
              f"{m('neg') / YD:.0f} | {m('spoilt') / YD:.0f} | {e['spare'] / YD:.0f} | {m('giniWealth'):.2f} | {m('top10'):.2f} |")


def persistence(name, by_year, lags=(10, 20, 30)):
    """Spearman rank correlation of a farm's wealth between year t and t + lag, over the farms occupied in both years."""
    out = {}
    years = sorted(by_year)
    for lag in lags:
        cs = []
        for t in years:
            if t + lag not in by_year or t < 5:
                continue
            a = {h['farm']: wealth(h) for h in by_year[t]}
            b = {h['farm']: wealth(h) for h in by_year[t + lag]}
            common = [f for f in a if f in b]
            if len(common) >= 8:
                cs.append(spearman([a[f] for f in common], [b[f] for f in common]))
        out[lag] = sum(cs) / len(cs) if cs else float('nan')
    print(f'{name}: rank correlation of farm wealth after ' + ', '.join(f'{k} yrs {v:.2f}' for k, v in out.items()))
    return out


def rolling(xs, k=5):
    out = []
    for i in range(len(xs)):
        w = xs[max(0, i - k // 2):i + k // 2 + 1]
        out.append(sum(w) / len(w))
    return out


def setup_mpl():
    import matplotlib
    matplotlib.use('Agg')
    import matplotlib.pyplot as plt
    plt.rcParams.update({'font.family': 'DejaVu Sans', 'font.size': 9, 'axes.edgecolor': C['axis'], 'axes.labelcolor': C['ink2'],
                         'xtick.color': C['muted'], 'ytick.color': C['muted'], 'axes.titlecolor': C['ink'], 'figure.facecolor': C['surface'],
                         'axes.facecolor': C['surface'], 'axes.grid': True, 'grid.color': C['grid'], 'grid.linewidth': 0.6,
                         'axes.spines.top': False, 'axes.spines.right': False, 'legend.frameon': False, 'lines.linewidth': 2})
    return plt


def grid_fig(plt, base, series, title, ylabel, path, note=None):
    """Small multiples, one panel per run, the same series in each; ceiling years (a village found no land worth clearing) ticked."""
    n = len(base)
    cols = 2 if n > 1 else 1
    rws = (n + cols - 1) // cols
    fig, axes = plt.subplots(rws, cols, figsize=(5.2 * cols, 2.9 * rws + 0.9), squeeze=False)
    for k, (name, rows) in enumerate(base):
        ax = axes[k // cols][k % cols]
        ys = [r['year'] for r in rows]
        for key, label, color, f in series:
            ax.plot(ys, rolling([f(r) for r in rows]), color=color, label=label)
        top = ax.get_ylim()[1]
        ceil = [r['year'] for r in rows if r['noLand'] > 0]
        if ceil:
            ax.plot(ceil, [0] * len(ceil), linestyle='none', marker='|', markersize=9, color=C['ink2'], label='a village finds no land to clear')
        ax.set_ylim(0, top)
        ax.set_title(name, fontsize=9, loc='left')
        ax.set_xlabel('year', fontsize=8)
        if k % cols == 0:
            ax.set_ylabel(ylabel, fontsize=8)
    for k in range(n, rws * cols):
        axes[k // cols][k % cols].axis('off')
    handles, labels = [], []
    for ax in axes.flat:
        for h, l in zip(*ax.get_legend_handles_labels()):
            if l not in labels:
                handles.append(h)
                labels.append(l)
    fig.legend(handles, labels, loc='lower center', ncol=len(labels), fontsize=8)
    fig.suptitle(title, x=0.01, y=0.985, ha='left', fontsize=11, color=C['ink'])
    if note:
        fig.text(0.01, 1 - 0.75 / fig.get_figheight(), note, fontsize=8, color=C['ink2'], va='top')
    fig.tight_layout(rect=(0, 0.06, 1, 1 - 0.95 / fig.get_figheight()))
    fig.savefig(path, dpi=120)
    plt.close(fig)


def figs(runs, outdir):
    plt = setup_mpl()
    base = [(n, r) for n, r, _ in runs if 'town' not in n]
    grid_fig(plt, base, [('pos', 'surplus of households above their need', C['blue'], lambda r: r['pos'] / YD),
                         ('neg', 'shortfall of households below their need', C['orange'], lambda r: r['neg'] / YD),
                         ('spoilt', 'grain that rots in store', C['aqua'], lambda r: r['spoilt'] / YD)],
             'Surplus and shortfall in the same years: food a market could move', 'person-years of food a year',
             f'{outdir}/cities-surplus.png', '5-year means. Surplus and shortfall: food made in the year (grain net of seed, milk, butter, meat) '
             'against need, summed over households above and below it.')
    grid_fig(plt, base, [('pop', 'people', C['blue'], lambda r: r['pop']),
                         ('landless', 'landless adults (18+)', C['orange'], lambda r: r['landless']),
                         ('crowded', 'waiting for land in a crowded village', C['aqua'], lambda r: r['crowded'])],
             'People, the landless, and hunger', 'count (5-year means)', f'{outdir}/cities-landless.png',
             'Landless: 18 or older, holding no farm, not married to a holder. Waiting: landless adults of a village with no room for a plot, '
             'after the moving round.')


def map_fig(d, path, title):
    """Market potential on foot and with boats over the map of one run's last year; villages by size; the best site of each marked."""
    import matplotlib
    matplotlib.use('Agg')
    import matplotlib.pyplot as plt
    from matplotlib.collections import PolyCollection
    from matplotlib.colors import LinearSegmentedColormap
    w = d['world']
    B = w['B']
    hx, hy, cols = w['hx'], w['hy'], w['cols']
    R = (hx[1] - hx[0]) / math.sqrt(3)
    hexv = [(R * math.cos(math.radians(90 + 60 * k)), R * math.sin(math.radians(90 + 60 * k))) for k in range(6)]
    land = [i for i in range(len(hx)) if not w['water'][i]]
    cmap = LinearSegmentedColormap.from_list('ramp', RAMP)
    snow, mount = B.get('SNOW', -1), B.get('MOUNTAIN', -2)
    fig, axes = plt.subplots(1, 2, figsize=(13, 13 * (max(hy) / max(hx)) / 2 + 1.2))
    for ax, key, label in [(axes[0], 'potFoot', 'on foot'), (axes[1], 'potBoat', 'on foot and by boat')]:
        pot = w[key]
        top = max(pot[i] for i in land) or 1
        polys, faces = [], []
        for i in range(len(hx)):
            polys.append([(hx[i] + x, hy[i] + y) for x, y in hexv])
            if w['water'][i]:
                faces.append('#f6f7f8')
            elif w['river'][i]:
                faces.append('#9fb3c4')
            elif pot[i] < 0.02 * top:
                faces.append('#e4dccb' if w['biome'][i] not in (snow, mount) else '#d3cbbb')
            else:
                faces.append(cmap(min(1.0, pot[i] / top)))
        ax.add_collection(PolyCollection(polys, facecolors=faces, edgecolors='none'))
        vs = [v for v in d['villages'] if v['people'] > 0]
        ax.scatter([v['x'] for v in vs], [v['y'] for v in vs], s=[8 + 2.2 * v['people'] for v in vs], facecolor=C['surface'],
                   edgecolor=C['ink'], linewidth=1.1, zorder=3)
        for v in sorted(vs, key=lambda v: -v['people'])[:3]:
            ax.annotate(f"{v['name']} ({v['people']})", (v['x'], v['y']), xytext=(-8, 9), textcoords='offset points', fontsize=8,
                        color=C['ink'], zorder=4, ha='right', bbox=dict(boxstyle='round,pad=0.15', fc=C['surface'], ec='none', alpha=0.8))
        best = max(land, key=lambda i: pot[i])
        coast = [i for i in land if any(w['water'][j] and w['ocean'][j] for j in neighbours(i, cols, len(hx)))]
        bestc = max(coast, key=lambda i: pot[i]) if coast else best
        ax.scatter([hx[best]], [hy[best]], marker='*', s=300, color=C['orange'], edgecolor=C['ink'], linewidth=0.8, zorder=5, label='best site')
        ax.scatter([hx[bestc]], [hy[bestc]], marker='D', s=80, color=C['orange'], edgecolor=C['ink'], linewidth=0.8, zorder=5, label='best shore site')
        ax.scatter([], [], s=60, facecolor=C['surface'], edgecolor=C['ink'], label='village (size by people)')
        ax.legend(loc='lower left', fontsize=8, frameon=True, facecolor=C['surface'], edgecolor=C['grid'])
        ax.set_xlim(0, max(hx) + R)
        ax.set_ylim(max(hy) + R, 0)
        ax.set_aspect('equal')
        ax.axis('off')
        ax.set_title(f'Market potential {label}', fontsize=10, loc='left', color=C['ink'])
    fig.suptitle(title, x=0.01, ha='left', fontsize=11, color=C['ink'])
    fig.text(0.01, 0.01, f"Potential of a land tile = sum over villages of people × exp(−cost / {w['lambda']}); cost in walking steps "
             f"(meadow 1, forest 1.5, hills and marsh 2, worn paths faster),\nand by boat {w['boat']} a water tile within 3 tiles of land "
             f"plus {w['embark']} to put out. Darker blue: more people within easy reach. Beige: out of reach of every village.",
             fontsize=8, color=C['ink2'])
    fig.tight_layout(rect=(0, 0.05, 1, 0.97))
    fig.savefig(path, dpi=110)
    plt.close(fig)


def neighbours(i, cols, n):
    """Neighbours of tile i on the pointy-top grid with odd rows shifted right (as gen.js lays it out); used only to find shore tiles."""
    r, c = divmod(i, cols)
    odd = r & 1
    ds = [(0, -1), (0, 1), (-1, -1 + odd), (-1, odd), (1, -1 + odd), (1, odd)]
    for dr, dc in ds:
        rr, cc = r + dr, c + dc
        if 0 <= cc < cols and 0 <= rr * cols + cc < n and rr >= 0:
            yield rr * cols + cc


def town_compare(runs):
    by = {n: r for n, r, _ in runs}
    for n, rows in by.items():
        if 'town' not in n:
            continue
        b = by.get(n.replace(' + town', ''))
        print(f'\n## {n} against {n.replace(" + town", "")}')
        print('| Years | Pop. on the map | Town (end) | Into town / yr | Town births / yr | Town deaths / yr | Town fed (%) | '
              'Crowded waiting (end) | Starved / yr on the map | Rotted / yr (person-yrs) |')
        print('|' + '---|' * 10)
        for a in range(0, len(rows), 10):
            ds, bs = rows[a:a + 10], (b or rows)[a:a + 10]
            if not ds:
                continue
            e, be = ds[-1], bs[-1]
            m = lambda xs, k: sum(r[k] for r in xs) / len(xs)
            fed = sum(r['townBought'] for r in ds) / max(1, sum(r['townNeed'] for r in ds))
            print(f"| {ds[0]['year']}–{e['year']} | {be['pop']} → {e['pop']} | {e['town']} | {m(ds, 'townIn'):.1f} | {m(ds, 'townBirths'):.1f} | "
                  f"{m(ds, 'townDeaths'):.1f} | {100 * fed:.0f} | {be['crowded']} → {e['crowded']} | {m(bs, 'starved'):.1f} → {m(ds, 'starved'):.1f} | "
                  f"{m(bs, 'spoilt') / YD:.0f} → {m(ds, 'spoilt') / YD:.0f} |")


if __name__ == '__main__':
    files = [a for a in sys.argv[1:] if a.endswith('.json')]
    outdir = sys.argv[sys.argv.index('--figs') + 1] if '--figs' in sys.argv else None
    runs = []
    for f in files:
        d = json.load(open(f))
        n, rows, by_year = summarise(d)
        runs.append((n, rows, by_year))
        decade_table(n, rows)
        persistence(n, by_year)
    town_compare(runs)
    if outdir:
        figs(runs, outdir)
        for f in files:
            d = json.load(open(f))
            if not d.get('town'):
                map_fig(d, f"{outdir}/cities-potential-{d['map']}-{d['seed']}.png",
                        f"Where a market town would draw most people: {d['scenario']}, {d['map']} map, seed {d['seed']}, year {d['years'][-1]['year']}")
