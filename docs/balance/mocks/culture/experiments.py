"""Run the mock's experiments in parallel and pickle the histories: python3 experiments.py E1 [E2 ...]"""
import os, sys, pickle, itertools
os.environ.setdefault('OMP_NUM_THREADS', '1')
from multiprocessing import Pool
from model import run, FEED, HEIR

HERE = os.path.dirname(os.path.abspath(__file__))
OUT = os.path.join(HERE, 'runs'); os.makedirs(OUT, exist_ok=True)
KEEP = ['t', 'pop', 'nvil', 'town', 'means', 'practice', 'cnt', 'vcult', 'ncult', 'D_att', 'D_prac', 'Fst', 'Fst_k', 'island_gap',
        'nclust', 'sharp', 'gap', 'ari', 'mar_inter', 'mar_island', 'mar_divide', 'changes', 'splits', 'island', 'founded', 'Kcap']

BASE = dict(start='different', mu=6.0, church_strength=0.3, hF=0.4, hL=0.4, famine_scope='village')


def exps(name):
    S4 = range(4); S6 = range(6)
    if name == 'E1':  # threshold: malus x geography x start, drift only (no hardship, no church)
        return [dict(seed=s, mu=m, geography=g, start=st) for g in ['two_islands', 'well_mixed'] for st in ['same', 'different']
                for m in [0, 2, 4, 6, 8, 12, 20] for s in S4]
    if name == 'E1b':  # opinion over practices instead of attitudes
        return [dict(seed=s, mu=m, dist='prac', start=st) for st in ['same', 'different'] for m in [0, 2, 4, 8, 12] for s in S4]
    if name == 'E2':  # trajectory and ablations around a base scenario
        var = {
            'base': {}, 'no boats': dict(boats_start=999, boats_full=1000), 'no town': dict(town_year=999), 'no church': dict(church_strength=0),
            'malus 0': dict(mu=0), 'same start': dict(start='same'), 'no hardship': dict(hF=0, hL=0),
            'minimal': dict(hF=0, hL=0, town_year=999),
        }
        return [dict(BASE, seed=s, label=k, **v) for k, v in var.items() for s in S6]
    if name == 'E3':  # ad hoc 'differing customs add hours' against opinion
        return [dict(seed=s, start='different', mode='adhoc', lam=l) for l in [0, 3, 6, 12, 24, 48] for s in S4]
    if name == 'E4a':  # constant hardship on every village: years for practice to move
        out = []
        for kind in ['feed', 'land']:
            for h in [0.05, 0.1, 0.2, 0.4, 0.8, 1.6]:
                fh = {v: ((1.0, 0.0) if kind == 'feed' else (0.0, 1.0)) for v in range(13)}
                out += [dict(seed=s, years=120, force_hardship=fh, hF=h if kind == 'feed' else 0, hL=h if kind == 'land' else 0, label=kind)
                        for s in range(3)]
        return out
    if name == 'E4b':  # same hardship everywhere vs different land
        var = {
            'no hardship': dict(hF=0, hL=0),
            'shared famine, even land': dict(hF=0.4, hL=0.4, famine_scope='map', land_het=0.0),
            'local famine, varied land': dict(hF=0.4, hL=0.4, famine_scope='village', land_het=0.5),
            'island A poor land': dict(hF=0.4, hL=0.4, famine_scope='village', land_het=0.0, K_islandA=45),
        }
        return [dict(seed=s, start='same', mu=0, label=k, **v) for k, v in var.items() for s in S6]
    if name == 'E5':  # phase diagram: malus against contact by boat
        return [dict(seed=s, start='different', mu=m, boats_max=b) for m in [0, 3, 6, 9, 12] for b in [0.25, 0.5, 1, 2, 4] for s in range(2)]
    if name == 'E6':  # aiming at the designer's trajectory: a rise from different land, a fall from late mixing
        T1 = dict(start='same', K_islandA=45, land_het=0.0, hF=0.4, hL=0.4, famine_scope='village', mu=6.0, church_strength=0.3)
        var = {
            'T1 poor island A, malus 6': {}, 'T1, malus 0': dict(mu=0),
            'T2 + Church claims heirs': dict(church_keys=((5, 0), (1, 1), (2, 0))),
            'T3 + conformity 0.05': dict(conform=0.05),
            'T4 + strong town sink': dict(town_share=0.45, town_cap=300),
            'T5 = T2 + T4': dict(church_keys=((5, 0), (1, 1), (2, 0)), town_share=0.45, town_cap=300),
        }
        return [dict(T1, seed=s, label=k, **v) for k, v in var.items() for s in range(4)]
    raise KeyError(name)


def one(kw):
    kw = dict(kw); label = kw.pop('label', None)
    try:
        h = run(**kw)
    except Exception as ex:  # keep the batch going; report the failure
        print('FAILED', kw, repr(ex), flush=True)
        return None
    return dict(params=dict(kw, label=label), h={k: h[k] for k in KEEP if k in h})


if __name__ == '__main__':
    for name in sys.argv[1:]:
        jobs = exps(name)
        with Pool(4) as pool:
            res = [r for r in pool.map(one, jobs, chunksize=1) if r is not None]
        with open(os.path.join(OUT, name + '.pkl'), 'wb') as f:
            pickle.dump(res, f)
        print(name, len(res), 'runs', flush=True)
