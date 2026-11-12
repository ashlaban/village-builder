"""Figures and numbers from the pickled runs: python3 analyze.py [E1 E2 ...]"""
import os, sys, pickle, json
import numpy as np
import matplotlib
matplotlib.use('Agg')
import matplotlib.pyplot as plt
from collections import defaultdict
from metrics import island_gap, island_prac_gap, prac_blocks, bimodality, series, smooth, villages
from model import CUSTOMS, MALL, LABELS, FEED, HEIR

HERE = os.path.dirname(os.path.abspath(__file__))
RUNS = os.path.join(HERE, 'runs')
SER = ['#2a78d6', '#eb6834', '#1baf7a', '#eda100', '#e87ba4', '#008300', '#6250d6', '#e34948']
INK, INK2, GRID, SURF = '#0b0b0b', '#52514e', '#e4e3df', '#fcfcfb'
plt.rcParams.update({'figure.facecolor': SURF, 'axes.facecolor': SURF, 'axes.edgecolor': INK2, 'axes.labelcolor': INK,
                     'xtick.color': INK2, 'ytick.color': INK2, 'axes.grid': True, 'grid.color': GRID, 'grid.linewidth': 0.6,
                     'axes.spines.top': False, 'axes.spines.right': False, 'lines.linewidth': 2, 'font.size': 9,
                     'axes.titlesize': 10, 'legend.frameon': False})
OUT = {}


def load(n):
    with open(os.path.join(RUNS, n + '.pkl'), 'rb') as f:
        return pickle.load(f)


def note(k, v):
    OUT[k] = v
    print(k, v)


def era(h, f, a, b, **kw):
    x = np.array([f(h, t, **kw) for t in range(a, b)], float)
    return np.nanmean(x)


# ---------- E1: the malus threshold ----------
def e1():
    R = load('E1') + []
    rb = load('E1b') if os.path.exists(os.path.join(RUNS, 'E1b.pkl')) else []
    groups = defaultdict(list)
    for r in R:
        p = r['params']; groups[(p['geography'], p['start'], p['mu'])].append(r['h'])
    mus = sorted({k[2] for k in groups})
    fig, ax = plt.subplots(1, 4, figsize=(15, 3.6))
    i = 0
    tab = {}
    for g in ['two_islands', 'well_mixed']:
        for st in ['same', 'different']:
            col = SER[i]; i += 1; lab = f"{'two islands' if g == 'two_islands' else 'one well-mixed land'}, {st} start"
            gap_mid = [np.mean([era(h, island_gap, 100, 150) for h in groups[(g, st, m)]]) for m in mus]
            gap_end = [np.mean([era(h, island_gap, 180, 200) for h in groups[(g, st, m)]]) for m in mus]
            blocks = [np.mean([np.mean([prac_blocks(h, t)[0] for t in range(100, 200, 5)]) for h in groups[(g, st, m)]]) for m in mus]
            sharp = [np.mean([era(h, bimodality, 100, 150) for h in groups[(g, st, m)]]) for m in mus]
            mi = [np.mean([np.nanmean(h['mar_island'][100:200]) / max(1e-9, np.nanmean(h['mar_inter'][100:200])) for h in groups[(g, st, m)]]) for m in mus]
            ax[0].plot(mus, gap_mid, 'o-', color=col, label=lab, ms=4)
            ax[0].plot(mus, gap_end, 'o--', color=col, ms=3, lw=1)
            ax[1].plot(mus, sharp, 'o-', color=col, ms=4)
            ax[2].plot(mus, blocks, 'o-', color=col, ms=4)
            ax[3].plot(mus, mi, 'o-', color=col, ms=4)
            tab[lab] = dict(mu=mus, gap_100_150=np.round(gap_mid, 3).tolist(), gap_180_200=np.round(gap_end, 3).tolist(),
                            between_share=np.round(sharp, 2).tolist(), blocks=np.round(blocks, 2).tolist(), cross_marriage=np.round(mi, 3).tolist())
    ax[0].set_title('Gap between founding groups\n(mean attitude, solid yr 100-150, dashed 180-200)')
    ax[1].set_title('Sharpness: between-group share of\nvillage variance, yr 100-150')
    ax[2].set_title('Practice blocks (>=15% of people)\nyr 100-200')
    ax[3].set_title('Marriages across the founding divide\n(share of inter-village), yr 100-200')
    for a in ax:
        a.set_xlabel('opinion malus mu (opinion = 1 - mu * distance)')
    ax[0].legend(fontsize=7, loc='upper left')
    fig.tight_layout(); fig.savefig(os.path.join(HERE, 'fig1_threshold.png'), dpi=130); plt.close(fig)
    note('E1', tab)
    # distribution of person-to-person distances for scale
    if rb:
        g2 = defaultdict(list)
        for r in rb:
            p = r['params']; g2[(p['start'], p['mu'])].append(r['h'])
        t2 = {}
        for st in ['same', 'different']:
            ms = sorted({k[1] for k in g2 if k[0] == st})
            t2[st] = dict(mu=ms, gap_100_150=[round(np.mean([era(h, island_gap, 100, 150) for h in g2[(st, m)]]), 3) for m in ms],
                          gap_180_200=[round(np.mean([era(h, island_gap, 180, 200) for h in g2[(st, m)]]), 3) for m in ms],
                          prac_gap_180_200=[round(np.mean([era(h, island_prac_gap, 180, 200) for h in g2[(st, m)]]), 3) for m in ms],
                          blocks=[round(np.mean([np.mean([prac_blocks(h, t)[0] for t in range(100, 200, 5)]) for h in g2[(st, m)]]), 2) for m in ms])
        note('E1b_practice_distance', t2)


# ---------- E2: the trajectory and ablations ----------
def e2():
    R = load('E2')
    groups = defaultdict(list)
    for r in R:
        groups[r['params']['label']].append(r['h'])
    T = np.arange(200)
    fig, ax = plt.subplots(1, 3, figsize=(15, 4))
    order = ['base', 'malus 0', 'no boats', 'no town', 'no church', 'no hardship', 'same start', 'minimal']
    tab = {}
    for i, k in enumerate(order):
        hs = groups[k]
        g = np.array([series(h, island_gap) for h in hs]); pg = np.array([series(h, island_prac_gap) for h in hs])
        sh = np.array([series(h, bimodality) for h in hs])
        col = SER[i % 8]; ls = '-' if i < 8 else '--'
        ax[0].plot(T, smooth(np.nanmean(g, 0)), color=col, ls=ls, label=k, lw=2.4 if k == 'base' else 1.5)
        ax[1].plot(T, smooth(np.nanmean(pg, 0)), color=col, ls=ls, lw=2.4 if k == 'base' else 1.5)
        ax[2].plot(T, smooth(np.nanmean(sh, 0), 15), color=col, ls=ls, lw=2.4 if k == 'base' else 1.5)
        mg = smooth(np.nanmean(g, 0))
        peak = int(np.nanargmax(mg[20:])) + 20
        tab[k] = dict(gap_y30=round(float(mg[30]), 3), gap_y80=round(float(mg[80]), 3), gap_y130=round(float(mg[130]), 3),
                      gap_y199=round(float(mg[195]), 3), peak_year_after20=peak, peak=round(float(mg[peak]), 3),
                      prac_gap_y80=round(float(smooth(np.nanmean(pg, 0))[80]), 3), prac_gap_y130=round(float(smooth(np.nanmean(pg, 0))[130]), 3),
                      prac_gap_y199=round(float(smooth(np.nanmean(pg, 0))[195]), 3),
                      cross_marriage_share_100_200=round(float(np.mean([np.nanmean(h['mar_island'][100:]) for h in hs])), 3),
                      splits=float(np.mean([len(h['splits']) for h in hs])))
    for a in ax:
        for x, lab in [(70, 'boats'), (120, 'town'), (150, 'church')]:
            a.axvline(x, color=INK2, lw=0.8, ls=':')
            a.text(x + 1, a.get_ylim()[1] * 0.97 if a.get_ylim()[1] else 0, lab, color=INK2, fontsize=7, va='top')
        a.set_xlabel('game year')
    ax[0].set_title('Attitude gap between the islands (mean over customs)')
    ax[1].set_title('Practice gap between the islands\n(share of customs whose majority practice differs)')
    ax[2].set_title('Sharpness: between-island share of village variance')
    ax[0].legend(fontsize=7)
    fig.tight_layout(); fig.savefig(os.path.join(HERE, 'fig2_trajectory.png'), dpi=130); plt.close(fig)
    note('E2', tab)
    # cluster map of the base scenario, seed 0
    h = groups['base'][0]
    yrs = [40, 90, 130, 170, 199]
    fig, ax = plt.subplots(1, len(yrs), figsize=(15, 3.4), sharey=True)
    from matplotlib.colors import LinearSegmentedColormap
    cmap = LinearSegmentedColormap.from_list('div', ['#2a78d6', '#f0efec', '#eb6834'])
    for a, y in zip(ax, yrs):
        m = h['means'][y].copy(); cnt = h['cnt'][y]
        m[cnt < 1] = np.nan
        im = a.imshow(m, cmap=cmap, vmin=0, vmax=1, aspect='auto')
        P = h['practice'][y]
        for v in range(m.shape[0]):
            for k in range(m.shape[1]):
                if cnt[v] >= 1:
                    a.text(k, v, str(P[v, k]), ha='center', va='center', fontsize=6, color=INK)
        a.set_title(f'year {y}'); a.set_xticks(range(6)); a.set_xticklabels(CUSTOMS, rotation=60, fontsize=7); a.grid(False)
        a.axhline(5.5, color=INK, lw=1); a.axhline(11.5, color=INK, lw=1)
    ax[0].set_yticks(range(13)); ax[0].set_yticklabels([f'A{v}' for v in range(6)] + [f'B{v}' for v in range(6)] + ['town'], fontsize=7)
    fig.colorbar(im, ax=ax, shrink=0.8, label='mean support for option 1 (digit: practice in force)')
    fig.savefig(os.path.join(HERE, 'fig3_cluster_map.png'), dpi=130, bbox_inches='tight'); plt.close(fig)


# ---------- E3: ad hoc distance vs opinion ----------
def e3():
    R = load('E3'); E1 = load('E1')
    fig, ax = plt.subplots(1, 3, figsize=(13, 3.6))
    ad = defaultdict(list)
    for r in R:
        ad[r['params']['lam']].append(r['h'])
    op = defaultdict(list)
    for r in E1:
        p = r['params']
        if p['geography'] == 'two_islands' and p['start'] == 'different':
            op[p['mu']].append(r['h'])
    tab = {}
    for name, G, col, xl in [('ad hoc: hours per differing practice', ad, SER[1], 'lambda (hours per differing practice)'),
                             ('opinion malus', op, SER[0], 'mu')]:
        xs = sorted(G)
        gm = [np.mean([era(h, island_gap, 100, 150) for h in G[x]]) for x in xs]
        ge = [np.mean([era(h, island_gap, 180, 200) for h in G[x]]) for x in xs]
        sd = [np.std([era(h, island_gap, 180, 200) for h in G[x]]) for x in xs]
        mi = [np.mean([np.nanmean(h['mar_island'][100:]) / max(1e-9, np.nanmean(h['mar_inter'][100:])) for h in G[x]]) for x in xs]
        # within-village spread: does the rule touch individuals inside a village?
        tab[name] = dict(x=xs, gap_100_150=np.round(gm, 3).tolist(), gap_180_200=np.round(ge, 3).tolist(), sd_180_200=np.round(sd, 3).tolist(),
                         cross_marriage=np.round(mi, 3).tolist())
        a0 = ax[0] if G is ad else ax[1]
        a0.errorbar(xs, ge, yerr=sd, fmt='o-', color=col, ms=4, capsize=2, label='yr 180-200')
        a0.plot(xs, gm, 'o--', color=col, ms=3, lw=1, label='yr 100-150')
        a0.set_xlabel(xl); a0.set_title(name); a0.legend(fontsize=7)
        ax[2].plot(gm, mi, 'o-', color=col, label=name, ms=4)
    ax[0].set_ylabel('attitude gap between islands')
    ax[2].set_xlabel('attitude gap, yr 100-150'); ax[2].set_ylabel('cross-island share of inter-village marriages')
    ax[2].set_title('Same gap, same marriages?'); ax[2].legend(fontsize=7)
    fig.tight_layout(); fig.savefig(os.path.join(HERE, 'fig4_opinion_vs_adhoc.png'), dpi=130); plt.close(fig)
    note('E3', tab)


# ---------- E4: hardship ----------
def e4():
    R = load('E4a')
    groups = defaultdict(list)
    for r in R:
        p = r['params']; h = p['hF'] if p['label'] == 'feed' else p['hL']; groups[(p['label'], h)].append(r['h'])
    fig, ax = plt.subplots(1, 3, figsize=(14, 3.6))
    tab = {}
    for i, (kind, k) in enumerate([('feed', FEED), ('land', HEIR)]):
        hs = sorted({x[1] for x in groups if x[0] == kind})
        t50 = []; att30 = []
        for hv in hs:
            ts = []; aa = []
            for h in groups[(kind, hv)]:
                # first year when half the people live under the pushed practice
                share = np.array([(h['practice'][t][:-1, k] * h['cnt'][t][:-1]).sum() / max(1, h['cnt'][t][:-1].sum()) for t in range(len(h['t']))])
                hit = np.nonzero(share >= 0.5)[0]
                ts.append(hit[0] if len(hit) else 130)
                aa.append(np.average(h['means'][30][:-1, k], weights=h['cnt'][30][:-1] + 1e-9))
            t50.append(np.median(ts)); att30.append(np.mean(aa))
        lab = "famine -> 'workers eat first' (m 0.5)" if kind == 'feed' else "land full -> 'one heir' (m 0.55)"
        ax[0].plot(hs, t50, 'o-', color=SER[i], label=lab, ms=4)
        ax[1].plot(hs, att30, 'o-', color=SER[i], label=lab, ms=4)
        tab[kind] = dict(push=hs, years_to_half=np.round(t50, 1).tolist(), support_y30=np.round(att30, 2).tolist())
    ax[0].axhline(30, color=INK2, lw=0.8, ls=':'); ax[0].text(0.05, 31, 'one generation', fontsize=7, color=INK2)
    ax[0].set_xscale('log'); ax[1].set_xscale('log')
    ax[0].set_xlabel('push rate a year at malleability 1 (game self-interest = 0.12)'); ax[0].set_ylabel('years until half the people live under it\n(130 = not within 120)')
    ax[1].set_xlabel('push rate'); ax[1].set_ylabel('mean support at year 30')
    ax[0].set_title('Constant hardship everywhere: time to move practice'); ax[1].set_title('Support for the pushed option after 30 years')
    ax[0].legend(fontsize=7)
    note('E4a', tab)
    R = load('E4b')
    g = defaultdict(list)
    for r in R:
        g[r['params']['label']].append(r['h'])
    t4 = {}
    for i, (k, hs) in enumerate(g.items()):
        def vs_spread(h, t, kk):
            vs = villages(h, t)
            return np.std(h['means'][t][vs, kk]) if len(vs) > 1 else np.nan
        sp = np.array([[np.nanmean([vs_spread(h, t, kk) for kk in (FEED, HEIR)]) for t in range(200)] for h in hs])
        lvl = np.array([[np.average(h['means'][t][:-1, HEIR], weights=h['cnt'][t][:-1] + 1e-9) for t in range(200)] for h in hs])
        ig = np.array([[abs(np.average(h['means'][t][[v for v in villages(h, t) if h['island'][v] == 0], HEIR]) -
                            np.average(h['means'][t][[v for v in villages(h, t) if h['island'][v] == 1], HEIR]))
                        if any(h['island'][v] == 0 for v in villages(h, t)) and any(h['island'][v] == 1 for v in villages(h, t)) else np.nan
                        for t in range(200)] for h in hs])
        ax[2].plot(range(200), smooth(np.nanmean(ig, 0)), color=SER[i], label=k)
        t4[k] = dict(spread_feed_heir_y100_150=round(float(np.nanmean(sp[:, 100:150])), 3), spread_y180_200=round(float(np.nanmean(sp[:, 180:])), 3),
                     heir_support_y150=round(float(np.mean(lvl[:, 150])), 3),
                     heir_island_gap_y60_120=round(float(np.nanmean(ig[:, 60:120])), 3), heir_island_gap_y180_200=round(float(np.nanmean(ig[:, 180:])), 3))
    ax[2].set_title("Island gap on 'how many heirs' (same start)"); ax[2].set_xlabel('game year'); ax[2].legend(fontsize=7)
    fig.tight_layout(); fig.savefig(os.path.join(HERE, 'fig5_hardship.png'), dpi=130); plt.close(fig)
    note('E4b', t4)


# ---------- E5: malus against contact ----------
def e5():
    R = load('E5')
    g = defaultdict(list)
    for r in R:
        p = r['params']; g[(p['mu'], p['boats_max'])].append(r['h'])
    mus = sorted({k[0] for k in g}); bs = sorted({k[1] for k in g})
    Z = np.array([[np.mean([era(h, island_gap, 185, 200) / max(1e-9, era(h, island_gap, 60, 70)) for h in g[(m, b)]]) for b in bs] for m in mus])
    Zm = np.array([[np.mean([np.nanmean(h['mar_island'][150:]) / max(1e-9, np.nanmean(h['mar_inter'][150:])) for h in g[(m, b)]]) for b in bs] for m in mus])
    fig, ax = plt.subplots(1, 2, figsize=(11, 4))
    for a, M, title in [(ax[0], Z, 'Share of the year-60s island gap left at 185-200'), (ax[1], Zm, 'Cross-island share of marriages, yr 150-200')]:
        im = a.imshow(M, origin='lower', cmap='Blues', aspect='auto')
        a.set_xticks(range(len(bs))); a.set_xticklabels(bs); a.set_yticks(range(len(mus))); a.set_yticklabels(mus)
        a.set_xlabel('contact by boat (multiplier of the full boat contact)'); a.set_ylabel('opinion malus mu'); a.set_title(title); a.grid(False)
        for i in range(len(mus)):
            for j in range(len(bs)):
                a.text(j, i, f'{M[i, j]:.2f}', ha='center', va='center', fontsize=7, color=INK if M[i, j] < M.max() * 0.6 else SURF)
        fig.colorbar(im, ax=a, shrink=0.8)
    fig.tight_layout(); fig.savefig(os.path.join(HERE, 'fig6_phase.png'), dpi=130); plt.close(fig)
    note('E5', dict(mu=mus, boats=bs, gap_left=np.round(Z, 2).tolist(), cross_marriage=np.round(Zm, 3).tolist()))


# ---------- E6: the designer's trajectory ----------
def e6():
    R = load('E6')
    g = defaultdict(list)
    for r in R:
        g[r['params']['label']].append(r['h'])
    def heir_gap(h, t):
        vs = villages(h, t); isl = h['island']
        a = [v for v in vs if isl[v] == 0]; b = [v for v in vs if isl[v] == 1]
        if not a or not b:
            return np.nan
        m = h['means'][t]; c = h['cnt'][t]
        return abs(np.average(m[a, HEIR], weights=c[a]) - np.average(m[b, HEIR], weights=c[b]))
    fig, ax = plt.subplots(1, 3, figsize=(15, 3.8))
    tab = {}
    for i, (k, hs) in enumerate(g.items()):
        hg = np.array([series(h, heir_gap) for h in hs]); pg = np.array([series(h, island_prac_gap) for h in hs])
        sp = np.array([[np.nanmean(h['D_prac'][t]) for t in range(200)] for h in hs])
        m1 = smooth(np.nanmean(hg, 0), 11); m2 = smooth(np.nanmean(pg, 0), 11)
        lw = 2.4 if i == 0 else 1.5
        ax[0].plot(range(200), m1, color=SER[i], lw=lw, label=k)
        ax[1].plot(range(200), m2, color=SER[i], lw=lw)
        ax[2].plot(range(200), smooth(np.nanmean(sp, 0), 11), color=SER[i], lw=lw)
        pk = int(np.nanargmax(m1))
        tab[k] = dict(heir_gap_y50=round(float(m1[50]), 3), heir_gap_y100=round(float(m1[100]), 3), heir_gap_y150=round(float(m1[150]), 3),
                      heir_gap_y195=round(float(m1[195]), 3), heir_peak_year=pk, heir_peak=round(float(m1[pk]), 3),
                      prac_gap_y100=round(float(m2[100]), 3), prac_gap_y150=round(float(m2[150]), 3), prac_gap_y195=round(float(m2[195]), 3),
                      prac_peak_year=int(np.nanargmax(m2)))
    for a in ax:
        for x, lab in [(70, 'boats'), (120, 'town'), (150, 'church')]:
            a.axvline(x, color=INK2, lw=0.8, ls=':')
        a.set_xlabel('game year')
    ax[0].set_title("Island gap in support for 'one heir takes all'"); ax[0].legend(fontsize=7)
    ax[1].set_title('Practice gap between the islands'); ax[2].set_title('Mean pairwise practice distance, all villages')
    fig.tight_layout(); fig.savefig(os.path.join(HERE, 'fig8_designer_trajectory.png'), dpi=130); plt.close(fig)
    note('E6', tab)


# ---------- property candidates ----------
def props():
    """For each candidate balance property: its response to mu (E1, two islands, different start) against its seed noise."""
    E1 = load('E1')
    g = defaultdict(list)
    for r in E1:
        p = r['params']
        if p['geography'] == 'two_islands' and p['start'] == 'different':
            g[p['mu']].append(r['h'])
    cands = {
        'attitude gap between blocks': lambda h: era(h, island_gap, 120, 170),
        'practice gap between blocks': lambda h: era(h, island_prac_gap, 120, 170),
        'between-village variance share (Fst)': lambda h: np.nanmean(h['Fst'][120:170]),
        'mean pairwise practice distance': lambda h: np.nanmean(h['D_prac'][120:170]),
        'practice blocks (count)': lambda h: np.mean([prac_blocks(h, t)[0] for t in range(120, 170, 5)]),
        'number of game cultures': lambda h: np.mean(h['ncult'][120:170]),
        'cross-divide marriage share': lambda h: np.nanmean(h['mar_island'][120:170]) / max(1e-9, np.nanmean(h['mar_inter'][120:170])),
        'sharpness (between share)': lambda h: era(h, bimodality, 120, 170),
    }
    mus = sorted(g)
    tab = {}
    fig, ax = plt.subplots(figsize=(7, 3.8))
    for i, (k, f) in enumerate(cands.items()):
        vals = [[f(h) for h in g[m]] for m in mus]
        mean = np.array([np.nanmean(v) for v in vals]); sd = np.array([np.nanstd(v) for v in vals])
        rng_ = mean.max() - mean.min(); noise = np.nanmean(sd)
        rho = np.corrcoef(mus, mean)[0, 1]
        tab[k] = dict(mean=np.round(mean, 3).tolist(), seed_sd=round(float(noise), 3), signal_to_noise=round(float(rng_ / max(noise, 1e-9)), 2),
                      monotone_corr=round(float(rho), 2))
    names = list(tab); snr = [tab[k]['signal_to_noise'] for k in names]
    order = np.argsort(snr)
    ax.barh([names[i] for i in order], [snr[i] for i in order], color=SER[0], height=0.6)
    ax.set_xlabel('range of the mean over mu 0..20, divided by the seed SD (years 120-170)')
    ax.set_title('Candidate culture properties: response to the malus against noise')
    fig.tight_layout(); fig.savefig(os.path.join(HERE, 'fig7_properties.png'), dpi=130); plt.close(fig)
    note('properties', tab)


if __name__ == '__main__':
    which = sys.argv[1:] or ['e1', 'e2', 'e3', 'e4', 'e5', 'e6', 'props']
    for w in which:
        try:
            globals()[w]()
        except FileNotFoundError as e:
            print('missing', e)
    path = os.path.join(HERE, 'results.json')
    old = json.load(open(path)) if os.path.exists(path) else {}
    old.update(OUT)
    json.dump(old, open(path, 'w'), indent=1, default=float)
