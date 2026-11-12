"""Sensitivity at year 200: one at a time +-25%, then a Latin hypercube of all parameters within +-25%."""
import json, sys
import numpy as np, pandas as pd
from scipy.stats import qmc, rankdata
import matplotlib
matplotlib.use('Agg')
import matplotlib.pyplot as plt
import model

pf = sys.argv[1] if len(sys.argv) > 1 else 'calibrated.json'
p0 = dict(model.BASE); p0.update(json.load(open(pf)))
KEYS = [k for k, v in p0.items() if isinstance(v, (int, float)) and v != 0]
OUT = ['pop', 'farm_share', 'T', 'E', 'made', 'extracted', 'kept', 'hungry', 'G', 'idle', 'Cn']
SCALE = dict(pop=1000, farm_share=0.6, T=325, E=75, made=1.67, extracted=0.4, kept=1.0, hungry=0.1, G=100, idle=0.5, Cn=0.3)
BAND = dict(pop=(900, 1100), farm_share=(0.55, 0.65), T=(275, 375), E=(60, 90), kept=(1.0, 9), hungry=(0, 0.10))


def res(p, seed=1):
    pp = dict(p)
    for k in ('t_fair', 't_debt', 't_craft', 't_ship', 't_town'): pp[k] = int(round(pp[k]))
    df = model.frame(model.run(pp, seed=seed)[0])
    e = df[df.t >= 190].mean()
    return dict(pop=e['pop'], farm_share=e.farm / e['pop'], T=e['T'], E=e.E, made=e.made, extracted=e.extracted, kept=e.kept,
                hungry=e.hungry, G=e.G, idle=e.idle, Cn=e.Cn)


if __name__ == '__main__':
    b = res(p0)
    # ---- one at a time
    rows = []
    for k in KEYS:
        lo = dict(p0); lo[k] = p0[k] * 0.75; hi = dict(p0); hi[k] = p0[k] * 1.25
        rl, rh = res(lo), res(hi)
        rows.append(dict(param=k, **{o: (rh[o] - rl[o]) / SCALE[o] for o in OUT}))
    O = pd.DataFrame(rows).set_index('param')
    O.to_csv('sens_oat.csv')
    A = O.abs()
    print('one at a time: total |effect| (sum over properties, each scaled by its target), top 12')
    print(A.sum(axis=1).sort_values(ascending=False).head(12).round(2).to_string())
    print('\nper property: top 3 parameters (effect of -25% -> +25%, in units of the target)')
    for o in OUT:
        top = O[o].abs().sort_values(ascending=False).head(3).index
        print(f'  {o:10s} ' + ', '.join(f'{t} {O.loc[t, o]:+.2f}' for t in top))
    # ---- Latin hypercube
    n = 400
    X = qmc.LatinHypercube(d=len(KEYS), seed=7).random(n) * 0.5 + 0.75
    Y = []
    for i in range(n):
        p = {k: p0[k] * X[i, j] for j, k in enumerate(KEYS)}
        try:
            Y.append(res(p))
        except Exception as ex:
            Y.append({o: np.nan for o in OUT})
    Y = pd.DataFrame(Y)
    Y.to_csv('sens_lhs.csv', index=False)
    # standardized rank regression coefficients
    Xr = np.column_stack([rankdata(X[:, j]) for j in range(len(KEYS))]); Xr = (Xr - Xr.mean(0)) / Xr.std(0)
    S = {}
    for o in OUT:
        y = Y[o].values; ok = np.isfinite(y)
        yr = rankdata(y[ok]); yr = (yr - yr.mean()) / yr.std()
        coef, *_ = np.linalg.lstsq(np.column_stack([Xr[ok], np.ones(ok.sum())]), yr, rcond=None)
        pred = np.column_stack([Xr[ok], np.ones(ok.sum())]) @ coef
        S[o] = dict(zip(KEYS, coef[:-1])); S[o]['R2'] = 1 - ((yr - pred) ** 2).sum() / (yr ** 2).sum()
    S = pd.DataFrame(S)
    S.to_csv('sens_srrc.csv')
    print('\nLatin hypercube (400 runs, all parameters +-25%): spread and robustness at year 200')
    for o in OUT:
        y = Y[o]
        band = BAND.get(o)
        inb = f"; in band {band}: {((y >= band[0]) & (y <= band[1])).mean():.0%}" if band else ''
        top = S[o].drop('R2').abs().sort_values(ascending=False).head(5).index
        print(f"  {o:10s} base {b[o]:8.3f}  p5 {y.quantile(.05):8.3f}  p95 {y.quantile(.95):8.3f}  rank-R2 {S.loc['R2', o]:.2f}{inb}")
        print('             ' + ', '.join(f'{t} {S.loc[t, o]:+.2f}' for t in top))
    allin = np.ones(n, bool)
    for o, (l, h) in BAND.items(): allin &= (Y[o] >= l).values & (Y[o] <= h).values
    print(f'runs with every banded property in band: {allin.mean():.0%}')
    imp = S.drop('R2').abs().mean(axis=1).sort_values(ascending=False)
    print('\nmean |SRRC| over properties, top 10:'); print(imp.head(10).round(3).to_string())
    # figure: heat map of |SRRC| for the top 15 parameters
    top = imp.head(15).index
    M = S.loc[top, OUT]
    fig, ax = plt.subplots(figsize=(10, 6))
    im = ax.imshow(M.values, cmap='RdBu', vmin=-1, vmax=1, aspect='auto')
    ax.set_xticks(range(len(OUT))); ax.set_xticklabels(OUT, fontsize=8, rotation=30)
    ax.set_yticks(range(len(top))); ax.set_yticklabels(top, fontsize=8)
    for i in range(M.shape[0]):
        for j in range(M.shape[1]):
            ax.text(j, i, f'{M.values[i, j]:+.2f}', ha='center', va='center', fontsize=7, color='white' if abs(M.values[i, j]) > .5 else '#222')
    ax.set_title('Standardized rank regression coefficients at year 200 (400 runs, all parameters +-25%)\n'
                 'columns: balance properties at year 200; R2 of the rank fit: ' +
                 ', '.join(f"{o} {S.loc['R2', o]:.2f}" for o in OUT[:6]), loc='left', fontsize=8)
    fig.colorbar(im, ax=ax, shrink=0.6); fig.tight_layout(); fig.savefig('fig3_sensitivity.png', dpi=130)
    # figure: spread of outcomes
    fig, axs = plt.subplots(1, 2, figsize=(11, 4))
    axs[0].scatter(Y['pop'] * Y.farm_share, Y['T'], s=8, c=Y.E, cmap='viridis'); axs[0].plot(600, 325, 'r+', ms=14)
    axs[0].set_xlabel('farming people'); axs[0].set_ylabel('town people'); axs[0].set_title('400 runs at year 200 (colour: elite)', loc='left', fontsize=9)
    axs[1].scatter(Y.kept, Y.hungry, s=8, c=Y['T'], cmap='viridis'); axs[1].axhline(0.1, color='r', lw=.8); axs[1].axvline(1, color='r', lw=.8)
    axs[1].set_xlabel('food kept per head'); axs[1].set_ylabel('share of households hungry'); axs[1].set_title('colour: town size', loc='left', fontsize=9)
    for a in axs: a.spines[['top', 'right']].set_visible(False)
    fig.tight_layout(); fig.savefig('fig4_lhs_spread.png', dpi=130)
