"""Response times: pulse each loop's stock at the mature state (no harvest noise) and time its return; also the
eigenvalues of the yearly map there (Jacobian by finite differences)."""
import json, math, sys
import numpy as np, pandas as pd
import matplotlib
matplotlib.use('Agg')
import matplotlib.pyplot as plt
import model

pf = sys.argv[1] if len(sys.argv) > 1 else 'calibrated.json'
p = json.load(open(pf))
Z = np.zeros(2000)
model.run(p, seed=1, record=False, shocks=Z, years=200)
eq = model.run(p, record=False, shocks=Z, init=model.run(p, record=False, shocks=Z, years=200), t0=200, years=300)
T0 = 500
H = 120


def track(init, off=(), key='pop', years=H):
    out, _ = model.run(p, record=True, shocks=Z, init=init, t0=T0, years=years, off=off)
    return model.frame(out)


ref = track(eq)
PULSES = [  # name, loop, stock changes, variable watched, loops to switch off for a comparison
    ('bad harvest (-40%, once)', 'B2/B3', None, 'h', ['B3']),
    ('farm people +15%', 'B1/B2', dict(C=1.15, A=1.15, O=1.15), 'farm', ['B1']),
    ('town people +30%', 'B4', dict(T=1.3), 'T', ['DIS']),
    ('elite people +30%', 'R1 via income', dict(E=1.3), 'E', []),
    ('tenancy share +0.2', 'R1/B5', None, 'Cn', ['B5']),
    ('wanted goods -50%', 'R2', dict(W=0.5), 'W', []),
    ('money habit -50%', 'R3', dict(Mo=0.5), 'Mo', []),
    ('goodwill -80%', 'B3/B6', dict(G=0.2), 'G', ['B6']),
    ('debt +20 units', 'R1', None, 'D', []),
]


def efold(dev):
    d0 = dev[0] if abs(dev[0]) > 1e-9 else dev[np.argmax(np.abs(dev))]
    i0 = int(np.argmax(np.abs(dev)))
    peak = dev[i0]
    for i in range(i0, len(dev)):
        if abs(dev[i]) < abs(peak) / math.e: return i, i0, peak
    return None, i0, peak


rows = []
fig, axs = plt.subplots(3, 3, figsize=(12, 8)); axs = axs.flat
for n, (name, loop, change, var, offs) in enumerate(PULSES):
    res = {}
    for label, off in [('all loops', ())] + [(f'{o} off', (o,)) for o in offs]:
        base = track(eq, off=off)
        init = dict(eq)
        if change:
            for k, v in change.items(): init[k] *= v
        if name.startswith('debt'): init['D'] += 20
        if name.startswith('tenancy'): init['Cn'] += 0.2; init['B'] += 0.0
        if name.startswith('bad'):
            zz = Z.copy(); zz[T0] = math.log(0.6) / p.get('sig_y', model.BASE['sig_y']) + p.get('sig_y', model.BASE['sig_y']) / 2
            out, _ = model.run(p, record=True, shocks=zz, init=init, t0=T0, years=H, off=off); d = model.frame(out)
        else:
            d = track(init, off=off)
        dev = (d[var] - base[var]).values
        t, i0, peak = efold(dev)
        res[label] = t
        axs[n].plot(d.t - T0, dev, label=f"{label}: e-fold {t if t is not None else '>' + str(H)} y")
    axs[n].axhline(0, color='#999', lw=.6); axs[n].set_title(f'{name} [{loop}] -> {var}', fontsize=8, loc='left')
    axs[n].legend(fontsize=7, frameon=False); axs[n].tick_params(labelsize=7); axs[n].spines[['top', 'right']].set_visible(False)
    rows.append(dict(pulse=name, loop=loop, watched=var, **{k: v for k, v in res.items()}))
fig.tight_layout(); fig.savefig('fig5_pulses.png', dpi=130)
R = pd.DataFrame(rows)
print(R.to_string())

# Jacobian of the yearly map at the mature state
KEYS = ['C', 'A', 'O', 'T', 'E', 'S', 'G', 'D', 'Cn', 'B', 'W', 'Mo', 'Ei']
x0 = np.array([eq[k] for k in KEYS])
sc = np.maximum(np.abs(x0), 1e-2)


def step(x):
    st = dict(eq); st.update({k: float(v) for k, v in zip(KEYS, x)})
    o = model.run(p, record=False, shocks=Z, init=st, t0=T0, years=1)
    return np.array([o[k] for k in KEYS])


f0 = step(x0)
J = np.zeros((len(KEYS), len(KEYS)))
for j in range(len(KEYS)):
    h = 1e-4 * sc[j]
    xp = x0.copy(); xp[j] += h; xm = x0.copy(); xm[j] -= h
    J[:, j] = (step(xp) - step(xm)) / (2 * h)
Js = J * sc[None, :] / sc[:, None]   # scaled
lam, V = np.linalg.eig(Js)
print('\neigenmodes of the yearly map at the mature state (|lambda|, time constant years, main stocks):')
for i in np.argsort(-np.abs(lam)):
    l = lam[i]; v = np.abs(V[:, i]); top = [KEYS[j] for j in np.argsort(-v)[:3]]
    tc = -1 / math.log(abs(l)) if 0 < abs(l) < 1 else float('inf') if abs(l) >= 1 else 0
    osc = f', oscillating period {2 * math.pi / abs(np.angle(l)):.1f} y' if abs(np.angle(l)) > 1e-6 else ''
    print(f'  |l|={abs(l):.3f}  tau={tc:6.1f} y  {top}{osc}')
