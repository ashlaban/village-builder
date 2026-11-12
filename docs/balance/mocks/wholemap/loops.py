"""Loop dominance: switch one loop off (a) for one phase only, restarting from the base run's state, and (b) for the whole run."""
import json, sys
import numpy as np, pandas as pd
import matplotlib
matplotlib.use('Agg')
import matplotlib.pyplot as plt
import model

pf = sys.argv[1] if len(sys.argv) > 1 else 'calibrated.json'
p = json.load(open(pf))
SEED = 1
LOOPS = {'B1': 'marriage valve', 'B2': 'hunger check (land limits, hunger kills)', 'B3': 'kin help', 'B4': 'town sink (migration)',
         'B5': 'brakes on estates', 'B6': 'feasting', 'R1': 'debt and land', 'R2': 'trade (wanted goods)', 'R3': 'money (silver tax)',
         'PAT': 'patronage', 'DIS': 'town disease'}
WIN = [('frontier', 0, 30), ('fair', 30, 60), ('debt', 60, 80), ('crafts', 80, 100), ('ship', 100, 110), ('town', 110, 150), ('mature', 150, 200)]
PROPS = ['farm', 'T', 'E', 'made', 'kept', 'hungry', 'idle', 'Cn', 'extracted', 'G']
SCALE = {'farm': 600, 'T': 325, 'E': 75, 'made': 1.67, 'kept': 1.0, 'hungry': 0.1, 'idle': 0.5, 'Cn': 0.3, 'extracted': 0.4, 'G': 100}

base, _ = model.run(p, seed=SEED); states = model.run.states; bdf = model.frame(base)


def endvals(df):
    e = df.iloc[-5:].mean()
    return e


rows = []
for k in LOOPS:
    for name, a, b in WIN:
        out, _ = model.run(p, seed=SEED, init=states[a], t0=a, years=b - a, off=[k])
        d = model.frame(out)
        e = endvals(d); be = endvals(bdf[(bdf.t >= a) & (bdf.t < b)])
        dpop = (e['pop'] - be['pop']) / be['pop']
        score = sum(abs(e[x] - be[x]) / SCALE[x] for x in PROPS)
        rows.append(dict(loop=k, window=name, dpop=dpop, score=score, **{f'd_{x}': e[x] - be[x] for x in PROPS}))
R = pd.DataFrame(rows)
R.to_csv('loops_by_phase.csv', index=False)

# whole-run knockouts
whole = []
be = endvals(bdf)
for k in LOOPS:
    d = model.frame(model.run(p, seed=SEED, off=[k])[0]); e = endvals(d)
    whole.append(dict(loop=k, **{x: e[x] for x in ['pop'] + PROPS}))
W = pd.DataFrame(whole).set_index('loop')
W.loc['base'] = [be[x] for x in ['pop'] + PROPS]
W.round(3).to_csv('loops_whole.csv')
print(W.round(2).to_string())

fig, axs = plt.subplots(1, 2, figsize=(13, 4.8))
for ax, col, title, cmap in [(axs[0], 'dpop', 'Change in population at the end of the phase, loop off for that phase only', 'RdBu'),
                             (axs[1], 'score', 'Change in the balance properties (sum of |change| / target scale)', 'Greys')]:
    M = R.pivot(index='loop', columns='window', values=col).loc[list(LOOPS), [w[0] for w in WIN]]
    v = np.nanmax(np.abs(M.values)) if col == 'dpop' else None
    im = ax.imshow(M.values, cmap=cmap, vmin=-v if v else 0, vmax=v if v else np.nanmax(M.values), aspect='auto')
    ax.set_xticks(range(len(WIN))); ax.set_xticklabels([f'{w[0]}\n{w[1]}-{w[2]}' for w in WIN], fontsize=8)
    ax.set_yticks(range(len(LOOPS))); ax.set_yticklabels([f'{k} {LOOPS[k]}' for k in LOOPS], fontsize=8)
    for i in range(M.shape[0]):
        for j in range(M.shape[1]):
            val = M.values[i, j]
            ax.text(j, i, f'{val:+.0%}' if col == 'dpop' else f'{val:.2f}', ha='center', va='center', fontsize=7,
                    color='white' if (abs(val) > 0.6 * (v or np.nanmax(M.values))) else '#222')
    ax.set_title(title, loc='left', fontsize=9)
fig.tight_layout(); fig.savefig('fig2_loops_by_phase.png', dpi=130)
print(R.pivot(index='loop', columns='window', values='score').loc[list(LOOPS), [w[0] for w in WIN]].round(2).to_string())
print(R.pivot(index='loop', columns='window', values='dpop').loc[list(LOOPS), [w[0] for w in WIN]].round(3).to_string())
