"""Q6: pulse responses at year 160 of the baseline. Each pulse is applied to a run and compared with the same seed unpulsed
(24 seeds; the random streams part after the pulse, so the difference of means is used). Response: peak deviation of the loop's
sensor, years to peak, years to recover half and 90% of the peak (or 'not within 60 years')."""
import numpy as np, pandas as pd
from multiprocessing import Pool
import model

T0, AFTER = 160, 70


def kill(w, frac):
    n = w.np_
    idx = np.where(w.alive[:n])[0]
    d = w.r.choice(idx, int(frac * len(idx)), replace=False)
    w.alive[d] = False


def town_half(w):
    n = w.np_
    idx = np.where(w.alive[:n] & (w.kind[w.hh[:n]] == 1))[0]
    w.alive[w.r.choice(idx, len(idx) // 2, replace=False)] = False


def concentrate(w):
    """a fifth of all owned fields pass to the 5 largest owners (an estate shock), tenants stay."""
    own = np.where(w.owner >= 0)[0]
    H = w.nh
    cnt = np.bincount(w.owner[own], None, H)
    top = np.argsort(-cnt)[:5]
    pick = w.r.choice(own, len(own) // 5, replace=False)
    w.owner[pick] = w.r.choice(top, len(pick))


PULSES = {
    'people -20%': (lambda w: kill(w, 0.2), 'pop'),
    'famine (stores to 0)': (lambda w: w.store.__setitem__(slice(0, w.nh), 0.0), 'hungry'),
    'goods habit to 0': (lambda w: w.habit.__setitem__(slice(0, w.nh), 0.0), 'D'),
    'town -50%': (town_half, 'town'),
    'offices emptied': (lambda w: w.office.__setitem__(slice(0, w.nh), False), 'elite_hh'),
    'land to 5 owners (+gini)': (concentrate, 'gini'),
    'goodwill wiped': (lambda w: w.gw.clear(), 'gw'),
    'debt shock (stores to 0, loans)': (lambda w: w.store.__setitem__(slice(0, w.nh), 0.0), 'tenancy'),
}


def run(args):
    name, seed, pulse = args
    kw = dict(seed=seed)
    w = model.World(**kw)
    rows = []
    for t in range(T0 + AFTER):
        if pulse and t == T0:
            PULSES[name][0](w)
        r = w.step(); w._last_wait = (r['wait_home'], r['wait_mate']); w._last_mig = r['mig']
        if t >= T0 - 10:
            rows.append({k: r[k] for k in ['t', 'pop', 'hungry', 'D', 'town', 'elite_hh', 'gini', 'gw', 'tenancy', 'debtors', 'ratio_mean', 'wait_home', 'births', 'lent', 'kin']})
    return name, seed, pulse, pd.DataFrame(rows)


def response(dev, t):
    dev = np.asarray(dev); post = dev[t >= T0]; tt = t[t >= T0] - T0
    k = int(np.argmax(np.abs(post))); peak = post[k]
    half = next((tt[j] for j in range(k, len(post)) if abs(post[j]) <= 0.5 * abs(peak)), None)
    ninety = next((tt[j] for j in range(k, len(post)) if abs(post[j]) <= 0.1 * abs(peak)), None)
    return peak, int(tt[k]), half, ninety


if __name__ == '__main__':
    jobs = [(n, s, p) for n in PULSES for s in range(24) for p in (False, True)]
    with Pool(4) as p:
        res = p.map(run, jobs, chunksize=4)
    out = []
    curves = {}
    for n in PULSES:
        var = PULSES[n][1]
        a = np.mean([r[3][var].values for r in res if r[0] == n and r[2]], 0)
        b = np.mean([r[3][var].values for r in res if r[0] == n and not r[2]], 0)
        t = res[0][3]['t'].values
        pk, tp, h, n90 = response(a - b, t)
        base = float(np.mean(b[t >= T0]))
        out.append(dict(pulse=n, sensor=var, base=round(base, 3), peak=round(float(pk), 3), years_to_peak=tp, half_recovery=h, recovery_90=n90))
        curves[n] = dict(t=t.tolist(), dev=(a - b).tolist(), base=b.tolist())
    df = pd.DataFrame(out)
    print(df.to_string())
    df.to_csv('pulses.csv', index=False)
    import json; json.dump(curves, open('pulse_curves.json', 'w'))
