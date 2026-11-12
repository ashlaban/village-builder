"""Figures (a)-(e) for REPORT.md."""
import json
import numpy as np, pandas as pd
import matplotlib
matplotlib.use('Agg')
import matplotlib.pyplot as plt
import runs, regime, model

C = ['#2a78d6', '#eb6834', '#1baf7a', '#eda100', '#e87ba4', '#008300', '#6250d6', '#e34948']
GREY = '#b0aea8'; INK = '#0b0b0b'; INK2 = '#52514e'
RCOL = {'ceiling': GREY, 'mates': C[0], 'homes': C[1], 'food': C[2], 'labour': C[3], 'extract': C[4], 'town': C[6], 'disease': C[7]}
SCOL = {'none': GREY, 'migrants M/(d-b)': C[0], 'goods demand': C[3], 'food S/c': C[2]}
plt.rcParams.update({'font.size': 9, 'axes.edgecolor': INK2, 'axes.labelcolor': INK, 'xtick.color': INK2, 'ytick.color': INK2,
                     'axes.spines.top': False, 'axes.spines.right': False, 'figure.facecolor': '#fcfcfb', 'axes.facecolor': '#fcfcfb'})
UNL = [('fair', 40), ('debt+land', 60), ('crafts', 80), ('ship+tax', 100), ('town', 110)]


def fig_a():
    base = runs.load('res_base.pkl')
    t = np.arange(200)
    def mat(f):
        return np.array([np.pad(f(r['df']), (0, 200 - len(r['df'])), constant_values=np.nan) for r in base])
    props = [('Population (log)', mat(lambda d: d['pop'].values), (900, 1100), 'log'),
             ('Food produced / need, farm households', mat(lambda d: d['ratio_mean'].values), (1.64, 1.86), None),
             ('Town and craft share of people', mat(lambda d: (d.town / d['pop']).values), (0.28, 0.37), None),
             ('Elite share of people', mat(lambda d: (d.elite / d['pop']).values), (0.06, 0.09), None),
             ('Hungry share of people (h > 0.2)', mat(lambda d: d.hungry.values), (0.0, 0.03), None),
             ('Land Gini (no band set)', mat(lambda d: d.gini.values), None, None)]
    fig = plt.figure(figsize=(10, 11))
    gs = fig.add_gridspec(len(props) + 2, 1, height_ratios=[1] * len(props) + [0.9, 0.6], hspace=0.35)
    for i, (name, M, band, sc) in enumerate(props):
        ax = fig.add_subplot(gs[i])
        if band:
            x0 = 150 if 'Population' in name or 'share' in name and 'Hungry' not in name else 0
            ax.axhspan(*band, xmin=x0 / 200, color=C[2], alpha=0.15, lw=0)
        med = np.nanmedian(M, 0); lo, hi = np.nanpercentile(M, [10, 90], 0)
        ax.fill_between(t, lo, hi, color=C[0], alpha=0.2, lw=0)
        ax.plot(t, med, color=C[0], lw=2)
        if sc: ax.set_yscale('log')
        ax.set_xlim(0, 200); ax.set_title(name, loc='left', fontsize=9, color=INK)
        for nm, y in UNL:
            ax.axvline(y, color=INK2, lw=0.6, ls=':')
            if i == 0: ax.text(y + 1, 1500 if nm != 'town' else 450, nm, fontsize=7, color=INK2, va='top')
        ax.tick_params(labelbottom=False)
    # regime bands: share of 16 seeds in each regime, year by year
    ax = fig.add_subplot(gs[len(props)])
    labs = np.array([np.pad(r['lab'].astype(object), (0, 200 - len(r['lab'])), constant_values='ceiling') for r in base])
    bottom = np.zeros(200)
    for k in regime.ORDER:
        f = (labs == k).mean(0)
        if f.sum() == 0: continue
        ax.bar(t, f, bottom=bottom, width=1.0, color=RCOL[k], label=k, lw=0)
        bottom += f
    ax.set_xlim(0, 200); ax.set_ylim(0, 1); ax.set_title('Binding growth limit (share of 16 seeds)', loc='left', fontsize=9)
    ax.legend(ncol=1, fontsize=7, frameon=False, loc='upper left', bbox_to_anchor=(1.0, 1.0)); ax.tick_params(labelbottom=False)
    ax = fig.add_subplot(gs[len(props) + 1])
    sps = np.array([np.pad(r['sp'].astype(object), (0, 200 - len(r['sp'])), constant_values='none') for r in base])
    bottom = np.zeros(200)
    for k, col in SCOL.items():
        f = (sps == k).mean(0)
        ax.bar(t, f, bottom=bottom, width=1.0, color=col, label=k, lw=0); bottom += f
    for nm, y in UNL: ax.axvline(y, color=INK, lw=0.6, ls=':')
    ax.set_xlim(0, 200); ax.set_ylim(0, 1); ax.set_title('Limit on the town (share of seeds)', loc='left', fontsize=9)
    ax.legend(ncol=1, fontsize=7, frameon=False, loc='upper left', bbox_to_anchor=(1.0, 1.1)); ax.set_xlabel('year')
    fig.suptitle('(a) Regime timeline, baseline, 16 seeds: properties (median, 10-90%) against target bands; binding limits below', x=0.02, ha='left', fontsize=10)
    fig.savefig('fig_a_timeline.png', dpi=130, bbox_inches='tight'); plt.close(fig)


def fig_b():
    S = pd.read_csv('lhs_S.csv')
    art = runs.load('res_staging.pkl')
    cols = [('first_homes', 'homes binds'), ('first2_migrants M/(d-b)', 'town: migrants bind'), ('first2_goods demand', 'town: goods demand binds'),
            ('full', 'map full'), ('first2_food S/c', 'town: food S/c binds'), ('y1000', 'population 1,000')]
    fig, axes = plt.subplots(1, 2, figsize=(11, 4.2), gridspec_kw=dict(width_ratios=[1.3, 1]))
    ax = axes[0]
    for i, (c, nm) in enumerate(cols):
        v = S[c].dropna(); v = v[v < 999]
        y = i + np.random.default_rng(i).uniform(-0.25, 0.25, len(v))
        ax.scatter(v, y, s=6, color=C[i % 8], alpha=0.5, lw=0)
        q = v.quantile([.1, .5, .9]).values
        ax.plot([q[0], q[2]], [i, i], color=INK, lw=1.5); ax.plot(q[1], i, 'o', color=INK, ms=4)
        ax.text(201, i, f'{len(v)}/300', fontsize=7, color=INK2, va='center')
    for nm, y in UNL: ax.axvline(y, color=INK2, lw=0.6, ls=':')
    ax.set_yticks(range(len(cols))); ax.set_yticklabels([n for _, n in cols]); ax.set_xlim(0, 210); ax.set_xlabel('year (dots: 300 sampled parameter sets; bar: 10-90%)')
    ax.set_title('(b) Spread of transition dates across samples', loc='left', fontsize=10)
    ax = axes[1]
    modes = [('date', 'unlocks by date'), ('late30', 'unlocks 30 yr later'), ('pop', 'unlocks by population'), ('all', 'all on from year 0'), ('none', 'built loops only')]
    for j, (m, nm) in enumerate(modes):
        T = pd.DataFrame([r['s'] for r in art[m]])
        for i, (c, lab) in enumerate([('first2_migrants M/(d-b)', 'migrants'), ('first2_goods demand', 'goods'), ('full', 'map full'), ('first2_food S/c', 'food S/c')]):
            if c not in T: continue
            v = T[c].dropna(); v = v[v < 999]
            if len(v) == 0: continue
            ax.plot(v.median(), j + (i - 1.5) * 0.15, 'o', color=C[[0, 3, 1, 2][i]], ms=6, label=lab if j == 0 else None)
            ax.plot([v.quantile(.25), v.quantile(.75)], [j + (i - 1.5) * 0.15] * 2, color=C[[0, 3, 1, 2][i]], lw=1)
    ax.set_yticks(range(len(modes))); ax.set_yticklabels([n for _, n in modes]); ax.set_xlim(0, 210); ax.set_xlabel('year (median, quartiles; 16 seeds)')
    ax.legend(fontsize=7, frameon=False, loc='upper right'); ax.set_title('Do the transitions follow the unlocks?', loc='left', fontsize=10)
    fig.tight_layout(); fig.savefig('fig_b_transitions.png', dpi=130); plt.close(fig)


def fig_c():
    D = pd.read_csv('roads_ts.csv')
    order = ['tithe+office', 'debt + office (baseline)', 'office + tax road', 'debt', 'debt, low valve (means 1.05)', 'life cycle + kin escheat', 'goodwill (designer road)', 'none']
    fig, axes = plt.subplots(1, 2, figsize=(11, 4.2))
    for ax, var, title in [(axes[0], 'elite_hh', 'Elite households (unearned income >= 0.75 need)'), (axes[1], 'gini', 'Land Gini')]:
        for i, nm in enumerate(order):
            g = D[D.road == nm].groupby('t')[var]
            m = g.median().rolling(5, min_periods=1).mean()
            ax.plot(m.index, m.values, color=C[i % 8] if nm != 'none' else GREY, lw=2 if i < 3 else 1.4, label=nm)
        if var == 'elite_hh':
            ax.add_patch(plt.Rectangle((140, 12), 20, 3, color=C[2], alpha=0.2, lw=0)); ax.text(141, 15.3, 'target at 150', fontsize=7, color=INK2)
        for nm, y in UNL: ax.axvline(y, color=INK2, lw=0.6, ls=':')
        ax.axvline(152, color=INK, lw=0.8, ls='--'); ax.text(153, ax.get_ylim()[1] * 0.95, 'map full (median)', fontsize=7, color=INK2, va='top')
        ax.set_title(title, loc='left', fontsize=9); ax.set_xlabel('year (median of 16 seeds)')
    axes[0].legend(fontsize=7, frameon=False, loc='upper left')
    fig.suptitle('(c) Elite under each candidate road (each switched on alone or as named)', x=0.02, ha='left', fontsize=10)
    fig.tight_layout(); fig.savefig('fig_c_roads.png', dpi=130); plt.close(fig)


def fig_d():
    T = pd.read_csv('dial_test.csv')
    fig, ax = plt.subplots(figsize=(6.4, 5.6))
    dials = list(dict.fromkeys(T.dial))
    lim = 25
    ax.plot([-lim, lim], [-lim, lim], color=INK2, lw=0.8); ax.axhline(0, color=GREY, lw=0.6); ax.axvline(0, color=GREY, lw=0.6)
    ax.fill_between([-lim, lim], [-lim * 2, lim * 2], [-lim / 2, lim / 2], color=GREY, alpha=0.12, lw=0)
    mk = {'pop': 'o', 'town_share': 's', 'elite_hh': '^', 'ratio': 'D', 'hungry_pts': 'v', 'gini_pts': 'P'}
    for i, d in enumerate(dials):
        s = T[T.dial == d]
        for _, r in s.iterrows():
            jitter = (i - 2) * 0.35
            ax.errorbar(r.predicted + jitter, r.measured, yerr=2 * r.se, fmt=mk[r.prop], color=C[i], ms=6, mfc=C[i] if r.significant else 'none', lw=0.8,
                        label=d if r.prop == 'pop' else None)
    for p, m in mk.items():
        ax.plot([], [], m, color=INK2, mfc='none', label=p)
    ax.set_xlim(-lim, lim); ax.set_ylim(-lim, lim)
    ax.set_xlabel('predicted from the dial table (% or points, +20% on the dial)'); ax.set_ylabel('measured in the model at year 150 (+-2 SE, 40 seeds)')
    ax.legend(fontsize=7, frameon=False, ncol=2, loc='upper left')
    ax.set_title('(d) Dial table against the model. Filled: significant. Grey wedge: within x2', loc='left', fontsize=9)
    fig.tight_layout(); fig.savefig('fig_d_dialtest.png', dpi=130); plt.close(fig)


def fig_e():
    cur = json.load(open('pulse_curves.json')); P = pd.read_csv('pulses.csv')
    fig, ax = plt.subplots(figsize=(8, 4))
    for i, (_, r) in enumerate(P.iterrows()):
        c = cur[r.pulse]; t = np.array(c['t']) - 160; dev = np.array(c['dev'])
        pk = r.peak if r.peak != 0 else 1
        ax.plot(t, pd.Series(dev / pk).rolling(3, center=True, min_periods=1).mean(), color=C[i % 8], lw=1.6, label=f'{r.pulse} ({r.sensor}; half {r.half_recovery} yr)')
    ax.axhline(0.5, color=GREY, lw=0.6, ls=':'); ax.set_xlim(-5, 69); ax.set_xlabel('years after the pulse (year 160 of the baseline)'); ax.set_ylabel('deviation / peak')
    ax.legend(fontsize=7, frameon=False, loc='upper right'); ax.set_title('(e) Pulse responses, 24 seeds: fast loops (left) to slow (right)', loc='left', fontsize=9)
    fig.tight_layout(); fig.savefig('fig_e_pulses.png', dpi=130); plt.close(fig)


if __name__ == '__main__':
    fig_a(); fig_b(); fig_c(); fig_d(); fig_e()
