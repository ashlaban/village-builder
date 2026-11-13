"""Shared runner: a run reduced to its frame plus regime labels and summary numbers."""
import pickle
import numpy as np
from multiprocessing import Pool
import model
import regime

KEEP = ['t', 'pop', 'farm', 'town', 'elite', 'elite_hh', 'estates', 'ratio_mean', 'under1', 'hungry', 'hungry_hh', 'hT', 'gini', 'tenancy',
        'extracted', 'sold', 'feast', 'rot', 'villages', 'free', 'D', 'S', 'S_lim', 'M_lim', 'mig', 'wait_home', 'births', 'deaths', 'idle',
        'labour_bound', 'lab_lost', 'ten_hungry', 'rent_tot', 'office_inc', 'interest', 'kin', 'patron', 'lent', 'gw', 'gw_fields', 'offices',
        'elite_off', 'debtors'] + ['L_' + g for g in regime.GROWTH]


def summarise(out, w):
    df = model.frame(out)
    lab, L = regime.growth_regime(df)
    sp = regime.split_regime(df)
    f, seq = regime.transitions(lab)
    f2, seq2 = regime.transitions(sp, 5)
    n = len(df)
    g = lambda c, a=180, b=200: float(df[c].iloc[min(a, n - 1):b].mean())
    full = np.where(df['villages'].values >= w.q['n_sites'])[0]
    p = df['pop'].values
    s = dict(pop150=int(p[min(150, n - 1)]), pop199=int(p[-1]), farm=g('farm'), town=g('town'), elite=g('elite'), elite_hh=g('elite_hh'),
             ratio=g('ratio_mean'), under1=g('under1'), hungry=g('hungry'), hungry_hh=g('hungry_hh'), hT=g('hT'), gini=g('gini'),
             tenancy=g('tenancy'), extracted=g('extracted'), sold=g('sold'), estates=g('estates'), idle=g('idle'),
             town150=g('town', 145, 155), elite150=g('elite', 145, 155), elite_hh150=g('elite_hh', 145, 155), ratio150=g('ratio_mean', 145, 155),
             hungry150=g('hungry', 145, 155), gini150=g('gini', 145, 155), tenancy150=g('tenancy', 145, 155),
             full=int(full[0]) if len(full) else 999, y300=int(np.argmax(p >= 300)) if (p >= 300).any() else 999,
             y1000=int(np.argmax(p >= 1000)) if (p >= 1000).any() else 999,
             seq='>'.join(seq), seq2='>'.join(seq2), mixed=regime.sharpness(L, lab), track=dict(w.track))
    for k, v in f.items():
        s['first_' + k] = v
    for k, v in f2.items():
        s['first2_' + k] = v
    # the last regime holding in the final 40 years
    s['late'] = max(set(lab[-40:]), key=list(lab[-40:]).count)
    s['late2'] = max(set(sp[-40:]), key=list(sp[-40:]).count)
    s['unlocked'] = dict(w.unlocked)
    return df[[c for c in KEEP if c in df]].astype(float, errors='ignore'), lab, sp, s


def one(kw):
    out, w = model.run(**kw)
    df, lab, sp, s = summarise(out, w)
    return dict(kw=kw, df=df, lab=lab, sp=sp, s=s)


def many(kws, procs=4, keep_df=True):
    with Pool(procs) as p:
        res = p.map(one, kws, chunksize=1)
    if not keep_df:
        for r in res:
            r['df'] = r['df'][['t', 'pop', 'town', 'elite', 'elite_hh', 'hungry', 'gini', 'ratio_mean']]
    return res


def save(obj, name):
    with open(name, 'wb') as f:
        pickle.dump(obj, f)


def load(name):
    with open(name, 'rb') as f:
        return pickle.load(f)
