"""Figures from figdata.pkl (run experiments.py first). python3 figures.py"""
import os, pickle
import numpy as np
import matplotlib
matplotlib.use('Agg')
import matplotlib.pyplot as plt

OUT = os.path.dirname(os.path.abspath(__file__))
F = pickle.load(open(os.path.join(OUT, 'figdata.pkl'), 'rb'))
R = F['R']
C = ['#2a78d6', '#eb6834', '#1baf7a', '#eda100', '#e87ba4', '#008300', '#6250d6', '#e34948']
INK, INK2, GRID = '#0b0b0b', '#52514e', '#e4e3df'
plt.rcParams.update({'font.size': 10, 'axes.edgecolor': INK2, 'axes.labelcolor': INK2, 'xtick.color': INK2, 'ytick.color': INK2,
                     'axes.spines.top': False, 'axes.spines.right': False, 'figure.facecolor': '#fcfcfb', 'axes.facecolor': '#fcfcfb'})

# 1. lever ranges
lv = R['levers']
rows = [('Disease x1 to x3 (uniform, or crowding at 1,000)', 'disease x1 to x3, uniform', 'x'),
        ('Chronic hunger 0 to 0.49', 'chronic hunger 0 to 0.49', 'h '),
        ('Women\'s marriage age 18 to 28', 'marriage age 18 to 28', ''),
        ('Never married 0 to 35%', 'never married 0 to 35%', ''),
        ('Nursing gap 0.5 to 2.5 years', 'nursing 0.5 to 2.5 y', ''),
        ('Nursing gap, infant death ends it', 'nursing 0.5 to 2.5 y, infant death ends it', ''),
        ('Famine year every 40 to 5 years', 'famine year (h 0.7) every 20 to 5 y', ''),
        ('Migration -5 to +5 a year at 1,000', 'migration -5 to +5 a year, N=1000', ''),
        ('Disease x1 to x3, crowding at 100', 'disease x1 to x3, crowding at N=100', ''),
        ('Migration -5 to +5 a year at 100', 'migration -5 to +5 a year, N=100', '')]
fig, ax = plt.subplots(figsize=(8, 5))
for i, (lab, key, _) in enumerate(rows):
    v = np.array(list(lv[key].values()), float)
    lo, hi = v.min(), v.max()
    col = C[1] if 'at 100' in lab else C[0]
    ax.barh(i, hi - lo, left=lo, height=0.55, color=col)
    ax.text(lo - 0.08, i, f'{lo:+.2f}', ha='right', va='center', color=INK2, fontsize=8)
    ax.text(hi + 0.08, i, f'{hi:+.2f}', ha='left', va='center', color=INK2, fontsize=8)
ax.set_yticks(range(len(rows)), [r[0] for r in rows])
ax.invert_yaxis()
ax.axvline(0, color=INK2, lw=1)
ax.axvline(-2.4, color=C[7], lw=1, ls='--')
ax.text(-2.45, -0.6, 'zero growth (-2.40)', color=INK2, fontsize=8, ha='right', va='bottom')
ax.set_xlabel('change in annual growth rate, percentage points (baseline +2.40%)')
ax.set_xlim(-6.5, 5.5)
ax.set_title('Range of each lever alone (blue: at 1,000 people; orange: at 100)', loc='left', color=INK, fontsize=11)
ax.grid(axis='x', color=GRID)
fig.tight_layout()
fig.savefig(os.path.join(OUT, 'fig_levers.png'), dpi=130)

# 2. growth budgets
bud = F['bud']
kind_col = {'marry': C[0], 'never': C[6], 'conception': C[3], 'deaths': C[7], 'cliff': C[4], 'town': C[2], 'disease': C[1], 'later': '#9a9994'}


def colour(lab):
    for k, c in kind_col.items():
        if k in lab:
            return c
    return '#9a9994'


fig, ax = plt.subplots(figsize=(10, 3.8))
names = list(bud)
for i, n in enumerate(names):
    steps = bud[n]
    prev = steps[0][1]
    for lab, val in steps[1:]:
        w = prev - val
        if abs(w) > 1e-6:
            ax.barh(i, -w, left=prev, height=0.6, color=colour(lab), edgecolor='#fcfcfb', lw=2)
            short = 'brakes' if 'later' in lab else lab.split('(')[0].strip()
            txt = f'{short} {-w:+.2f}' if w > 0.55 else f'{-w:+.2f}'
            ax.text(prev - w / 2, i, txt, ha='center', va='center', fontsize=7, color='white')
        else:
            ax.text(2.45, i, f'+ {lab}: 0.00', ha='left', va='center', fontsize=7, color=INK2)
        prev = val
    ax.plot([prev], [i], marker='|', color=INK, ms=14)
ax.set_yticks(range(len(names)), names)
ax.invert_yaxis()
ax.set_xlim(-0.1, 4.0)
ax.set_xticks([0, 0.5, 1, 1.5, 2, 2.4])
ax.axvline(0, color=INK2, lw=1)
ax.set_xlabel('annual growth rate, % (bars: what each lever takes from the biological ceiling of 2.40%)')
ax.set_title('Growth budget of each recipe for zero growth at 1,000', loc='left', color=INK, fontsize=11)
fig.tight_layout()
fig.savefig(os.path.join(OUT, 'fig_budget.png'), dpi=130)

# 3. recovery
fig, ax = plt.subplots(figsize=(8, 3.8))
T0 = F['T0']
for i, (n, N) in enumerate(F['traj'].items()):
    t = np.arange(len(N)) - T0
    ax.plot(t, N, color=C[i], lw=2, label=n)
ax.axhline(1, color=INK2, lw=1)
ax.axhspan(0.98, 1.02, color=GRID, zorder=0)
ax.set_xlim(-5, 160)
ax.set_xlabel('years after a famine year that kills 15%')
ax.set_ylabel('people / level before')
ax.legend(frameon=False, fontsize=8, loc='lower right')
ax.set_title('Recovery after a shock: marriage-held recipes overshoot in a generation echo', loc='left', color=INK, fontsize=11)
ax.grid(color=GRID)
fig.tight_layout()
fig.savefig(os.path.join(OUT, 'fig_recovery.png'), dpi=130)

# 4. pyramids (women, 5-year groups)
pyr = F['pyr']
fig, axs = plt.subplots(1, len(pyr), figsize=(12, 3.6), sharey=True)
for ax, (n, z) in zip(axs, pyr.items()):
    g = lambda a: a[:80].reshape(16, 5).sum(1)
    married, single = g(z[0, 2]), g(z[0, 0] + z[0, 1])
    town = g(z[1].sum(0))
    y = np.arange(16) * 5
    ax.barh(y, married, height=4, color=C[0], label='rural married')
    ax.barh(y, single, left=married, height=4, color=C[6], label='rural single (and girls)')
    ax.barh(y, town, left=married + single, height=4, color=C[2], label='town')
    ax.set_title(n, fontsize=9, color=INK)
    ax.set_xlabel('women')
axs[0].set_ylabel('age')
axs[0].legend(frameon=False, fontsize=7)
fig.suptitle('Age structure of women at the 1,000 equilibrium', x=0.01, ha='left', color=INK, fontsize=11)
fig.tight_layout()
fig.savefig(os.path.join(OUT, 'fig_pyramids.png'), dpi=130)

# 5. town
fig, (a1, a2) = plt.subplots(1, 2, figsize=(10, 3.6))
for i, (qt, rows_) in enumerate(R['town_grid'].items()):
    D = [r['D'] for r in rows_ if r['town_share'] is not None]
    s = [r['town_share'] for r in rows_ if r['town_share'] is not None]
    a1.plot(D, s, marker='o', color=C[i], lw=2, label=f'{float(qt):.0%} of migrants marry in town')
a1.axhline(0.325, color=INK2, ls='--', lw=1)
a1.text(5.9, 0.335, '325 of 1,000', ha='right', fontsize=8, color=INK2)
a1.set_xlabel('town death multiplier D_town')
a1.set_ylabel('town share of a stable 1,000')
a1.set_ylim(0, 1)
a1.legend(frameon=False, fontsize=8)
a1.grid(color=GRID)
a1.set_title('Town size is set by its own deaths and births', loc='left', fontsize=10, color=INK)
fill = F['fill']
a2.plot(np.arange(len(fill)), fill, color=C[2], lw=2, label='town fed 9.5 migrants a year, from empty')
tf = R['town_formula']
a2.axhline(tf['M_over_d_minus_b'], color=INK2, ls='--', lw=1)
a2.text(195, tf['M_over_d_minus_b'] + 8, f"M/(d-b) = {tf['M_over_d_minus_b']:.0f}", ha='right', fontsize=8, color=INK2)
a2.axhline(tf['naive_from_rural_rates'], color=C[7], ls=':', lw=1)
a2.text(195, tf['naive_from_rural_rates'] + 8, f"naive d, b from rural rates: {tf['naive_from_rural_rates']:.0f}", ha='right', fontsize=8, color=INK2)
a2.set_xlabel('years')
a2.set_ylabel('town people')
a2.grid(color=GRID)
a2.set_title('Town fill: 90% in about 50 years', loc='left', fontsize=10, color=INK)
fig.tight_layout()
fig.savefig(os.path.join(OUT, 'fig_town.png'), dpi=130)
print('figures written')
