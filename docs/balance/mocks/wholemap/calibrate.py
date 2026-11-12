"""Find a parameter set that ends near 1,000 = 600/325/75 with food kept above the floor and some tenancy."""
import json, math, sys
import numpy as np
from scipy.optimize import differential_evolution
import model

# parameters free in the search, with the range I judged plausible beforehand
FREE = {
    'y': (1.8, 3.0), 'cv_hh': (0.25, 0.7), 'sig_y': (0.10, 0.30), 'res': (0.3, 1.5), 'f_feast': (0.2, 0.9),
    'beta': (0.2, 0.9), 'k_def': (0.1, 0.8), 'mu': (0.05, 0.5), 'crowd': (0.0, 0.06), 'cE': (1.0, 3.0),
    'kH': (0.5, 0.95), 'm1': (0.3, 2.5), 's1': (0.1, 0.8), 'tithe': (0.0, 0.12), 'pat': (0.0, 0.6), 'tau_E': (3, 20),
}
# a wider box, to see where the optimiser wants to go when allowed
WIDE = {k: (lo * 0.25, hi * 3) for k, (lo, hi) in FREE.items()}
WIDE['tithe'] = (0.0, 0.4)
for k in ('f_feast', 'beta', 'mu', 'pat', 's1', 'k_def'): WIDE[k] = (WIDE[k][0], 1.0)   # shares cannot pass 1
WIDE['cv_hh'] = (0.1, 1.5); WIDE['kH'] = (0.3, 1.0)


def outcomes(p, seed=1):
    df = model.frame(model.run(p, seed=seed)[0])
    end = df[df.t >= 190].mean()
    reach = df.t[df['pop'] >= 900]
    return dict(pop=end['pop'], farm=end.farm, T=end['T'], E=end.E, hungry=end.hungry, kept=end.kept, h=end.h,
                Cn=end.Cn, made=end.made, extracted=end.extracted, out_share=(end.rent + end.tithe + end.rep + end.sold) / end.P,
                idle=end.idle, G=end.G, t900=float(reach.iloc[0]) if len(reach) else 999.0,
                hungry_max=df[df.t >= 60].hungry.max())


def loss(o):
    L = (math.log(max(o['farm'], 1) / 600)) ** 2 + (math.log(max(o['T'], 1) / 325)) ** 2 + (math.log(max(o['E'], 1) / 75)) ** 2
    L += 4 * max(0, o['hungry'] - 0.10) ** 2 + 4 * max(0, 1.0 - o['kept']) ** 2
    L += 2 * (o['Cn'] - 0.30) ** 2 + 0.2 * ((o['t900'] - 150) / 50) ** 2
    return L


def f(x, keys):
    p = dict(zip(keys, x))
    try:
        return loss(outcomes(p))
    except Exception:
        return 1e3


if __name__ == '__main__':
    box = WIDE if 'wide' in sys.argv else FREE
    keys = list(box)
    r = differential_evolution(f, [box[k] for k in keys], args=(keys,), seed=3, maxiter=60, popsize=12, tol=1e-6, polish=False,
                               workers=1, updating='deferred')
    p = dict(zip(keys, map(float, r.x)))
    o = outcomes(p)
    print('loss', r.fun)
    for k in keys:
        lo, hi = FREE[k]
        flag = '  OUTSIDE plausible' if not (lo <= p[k] <= hi) else ('  at edge' if min(p[k] - lo, hi - p[k]) < 0.03 * (hi - lo) else '')
        print(f'  {k:8s} {p[k]:8.3f}  base {model.BASE[k]:7.3f}  plausible {lo}-{hi}{flag}')
    print({k: round(v, 3) for k, v in o.items()})
    for s in (2, 3, 4, 5):
        oo = outcomes(p, seed=s)
        print('seed', s, {k: round(oo[k], 2) for k in ('pop', 'farm', 'T', 'E', 'hungry', 'kept', 'Cn', 't900')})
    name = 'calibrated_wide.json' if 'wide' in sys.argv else 'calibrated.json'
    json.dump(p, open(name, 'w'), indent=1)
