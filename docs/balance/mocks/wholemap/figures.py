"""Time series of the calibrated run: people by class, the balance properties, and the food budget."""
import json, sys
import matplotlib
matplotlib.use('Agg')
import matplotlib.pyplot as plt
import numpy as np
import model

pf = sys.argv[1] if len(sys.argv) > 1 else 'calibrated.json'
p = json.load(open(pf))
q = dict(model.BASE); q.update(p)
df = model.frame(model.run(p)[0])
PH = [('fair', q['t_fair']), ('debt+land', q['t_debt']), ('crafts', q['t_craft']), ('ship+tax', q['t_ship']), ('town', q['t_town'])]
INK = '#333'; COL = ['#2a6f97', '#e07a2f', '#7b4fa0', '#4f9d69', '#c44e52', '#8c8c8c', '#b5a03b']


def phases(ax):
    for n, t in PH:
        ax.axvline(t, color='#bbb', lw=0.8, zorder=0)
        ax.text(t + 1, ax.get_ylim()[1] * 0.97, n, fontsize=7, color='#777', va='top', rotation=90)


fig, axs = plt.subplots(2, 2, figsize=(12, 7.5))
ax = axs[0, 0]
ax.stackplot(df.t, df.farm, df['T'], df.E, labels=['farming', 'town and crafts', 'elite'], colors=COL[:3], alpha=0.85)
ax.axhline(1000, ls=':', color=INK, lw=0.8); ax.set_title('People by class (target 600 / 325 / 75)', loc='left', fontsize=10)
ax.legend(loc='upper left', fontsize=8, frameon=False); phases(ax)
ax = axs[0, 1]
for k, lab, c in [('made', 'food produced / farm need', COL[0]), ('kept', 'food kept per head (eaten+store)/need', COL[1]),
                  ('idle', 'idle share of hours', COL[3]), ('Cn', 'tenancy share', COL[2]), ('extracted', 'share extracted', COL[4])]:
    ax.plot(df.t, df[k].rolling(5, min_periods=1).mean(), label=lab, color=c, lw=1.6)
ax.plot(df.t, df.hungry.rolling(5, min_periods=1).mean() * 10, label='hungry households x10', color=COL[5], lw=1.2, ls='--')
ax.set_ylim(0, 3); ax.set_title('Balance properties (5-year means)', loc='left', fontsize=10); ax.legend(fontsize=7, frameon=False, ncol=2)
phases(ax)
ax = axs[1, 0]
P = df.P.rolling(5, min_periods=1).mean()
parts = [('eaten on the farm', df.own_eaten), ('taken (rent, tithe, interest)', df.rent + df.tithe + df.rep), ('sold', df.sold),
         ('feasted', df.feast), ('rotted', df.rot), ('into store', df.dS.clip(lower=0))]
ax.stackplot(df.t, *[(v.rolling(5, min_periods=1).mean() / P) for _, v in parts], labels=[n for n, _ in parts], colors=COL[:6], alpha=0.85)
ax.set_ylim(0, 1.15); ax.set_title('Where the farm food goes (share of produced; drawdown of store not shown)', loc='left', fontsize=10)
ax.legend(fontsize=7, frameon=False, loc='lower left', ncol=2); phases(ax)
ax = axs[1, 1]
for k, lab, c in [('G', 'goodwill in circulation (need-units)', COL[0]), ('W', 'wanted goods per household x100', COL[1]),
                  ('L', 'land cleared (fields)', COL[3]), ('D', 'debt (need-units) x10', COL[4])]:
    v = df[k] * (100 if k == 'W' else 10 if k == 'D' else 1)
    ax.plot(df.t, v.rolling(5, min_periods=1).mean(), label=lab, color=c, lw=1.6)
ax.set_title('Supporting stocks', loc='left', fontsize=10); ax.legend(fontsize=7, frameon=False); phases(ax)
for a in axs.flat:
    a.spines[['top', 'right']].set_visible(False); a.set_xlabel('year', fontsize=8); a.tick_params(labelsize=8)
fig.tight_layout(); fig.savefig('fig1_run.png', dpi=130)
print(df.iloc[::25][['t', 'pop', 'farm', 'T', 'E', 'made', 'kept', 'hungry', 'idle', 'Cn', 'extracted', 'G', 'feast', 'sold']].round(2).to_string())

# ---- regime timeline: which constraint binds each year
fig, ax = plt.subplots(figsize=(12, 3.2))
rows = [
    ('output set by wish (target)', (df.bind == 0)),
    ('output set by land (ceiling)', (df.bind == 1)),
    ('output set by labour', (df.bind == 2)),
    ('land > 95% cleared', df.Lgap > 0.95),
    ('marriage gate shuts out >10% of adults', df.gate > 0.1),
    ('migrants leave for town/crafts', df.mig > 1),
    ('hungry households > 5%', df.hungry.rolling(3, min_periods=1).mean() > 0.05),
    ('town short of food', df.hT > 0.02),
    ('feasting > 3% of output', df.feast / df.P > 0.03),
    ('extraction > 10% of output', df.extracted > 0.10),
    ('tenancy > 3%', df.Cn > 0.03),
]
for i, (n, m) in enumerate(rows):
    ax.broken_barh([(t, 1) for t in df.t[m.values]], (len(rows) - i - 0.8, 0.6), color=COL[i % len(COL)])
ax.set_yticks([len(rows) - i - 0.5 for i in range(len(rows))]); ax.set_yticklabels([r[0] for r in rows], fontsize=8)
for n, t in PH: ax.axvline(t, color='#bbb', lw=0.8); ax.text(t + 1, len(rows) + 0.1, n, fontsize=7, color='#777')
ax.set_xlim(0, 200); ax.set_xlabel('year', fontsize=8); ax.spines[['top', 'right']].set_visible(False)
ax.set_title('Regime timeline: which constraint or loop is active, year by year', loc='left', fontsize=10)
fig.tight_layout(); fig.savefig('fig6_regimes.png', dpi=130)
