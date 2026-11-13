"""Q2: regimes over the baseline, over sampled parameter sets, and with the unlocks moved (is the sequence an artefact of staging?)."""
import numpy as np
import pandas as pd
import runs
import model

DIALS = {  # name: (low, high) multipliers on BASE, or ('add', lo, hi) for dates
    'yf': (0.75, 1.25), 'g0': (0.75, 1.25), 'means': (0.8, 1.2), 'fpw': (0.8, 1.2), 'village_cap': (0.75, 1.25), 'p_found': (0.5, 2.0),
    'imm': (0.5, 2.0), 'mu': (0.6, 1.5), 'town_d': (0.75, 1.25), 'Wd1': (0.6, 1.5), 'qc': (0.75, 1.25), 'tithe': (0.6, 1.5),
    'interest': (0.6, 1.5), 'rent': (0.6, 1.4), 'tax': (0.5, 1.5), 'feast_rate': (0.6, 1.4), 'nurse': (0.5, 1.5), 'child_mort': (0.7, 1.3),
    'hh_sd': (0.6, 1.4), 'target': (0.85, 1.15),
    't_fair': ('add', -15, 15), 't_debt': ('add', -15, 15), 't_craft': ('add', -15, 15), 't_ship': ('add', -15, 15), 't_town': ('add', -15, 15),
}


def sample(n, seed=0):
    r = np.random.default_rng(seed)
    kws, X = [], []
    perm = {k: r.permutation(n) for k in DIALS}
    for i in range(n):
        kw = dict(seed=1000 + i); x = {}
        for k, spec in DIALS.items():
            u = (perm[k][i] + r.random()) / n   # Latin hypercube column
            if spec[0] == 'add':
                v = model.BASE[k] + spec[1] + u * (spec[2] - spec[1]); kw[k] = int(round(v)); x[k] = kw[k] - model.BASE[k]
            else:
                m = np.exp(np.log(spec[0]) + u * (np.log(spec[1]) - np.log(spec[0])))
                v = model.BASE[k] * m
                kw[k] = int(round(v)) if isinstance(model.BASE[k], int) else float(v); x[k] = np.log(kw[k] / model.BASE[k])
        kws.append(kw); X.append(x)
    return kws, pd.DataFrame(X)


if __name__ == '__main__':
    base = runs.many([dict(seed=s) for s in range(16)])
    runs.save(base, 'res_base.pkl')
    dis = runs.many([dict(seed=s, disease=True) for s in range(16)])
    runs.save(dis, 'res_disease.pkl')
    kws, X = sample(300)
    res = runs.many(kws, keep_df=False)
    S = pd.DataFrame([r['s'] for r in res])
    X.to_csv('lhs_X.csv', index=False)
    S.drop(columns=['track', 'unlocked']).to_csv('lhs_S.csv', index=False)
    runs.save(res, 'res_lhs.pkl')
    # staging tests
    art = {}
    art['date'] = base
    art['pop'] = runs.many([dict(seed=s, unlock='pop') for s in range(16)])
    art['all'] = runs.many([dict(seed=s, unlock='all') for s in range(16)])
    art['late30'] = runs.many([dict(seed=s, t_fair=70, t_debt=90, t_craft=110, t_ship=130, t_town=140) for s in range(16)])
    art['none'] = runs.many([dict(seed=s, t_fair=999, t_debt=999, t_craft=999, t_ship=999, t_town=999) for s in range(16)])
    runs.save(art, 'res_staging.pkl')
    print('done')
