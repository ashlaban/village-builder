"""Runs the experiments; saves results/<name>.pkl. Usage: python3 exp.py [name ...]"""
import sys, os, pickle, itertools
from multiprocessing import Pool
from model import run

KEEP = ['year', 'n', 'pop', 'gini', 'tenancy', 'landless', 'vacant', 'big15', 'landed_rent', 'landed_half', 'landed_brief',
        'hungry', 'tenant_short', 'tenant_kept', 'tenant_hungry', 'debtors', 'clients', 'remedy', 'max_owned', 'top_share', 'weather']
L = dict(loans=True)


def one(args):
    name, label, kw, seed = args
    o = run(seed=seed, record_lorenz=(1, 50, 100, 150) if seed == 0 else (), track=(seed == 0 and kw.get("_track", False)),
            **{k: v for k, v in kw.items() if not k.startswith("_")})
    rows = [{k: (float(v) if k != 'year' else v) for k, v in m.items() if k in KEEP or k.startswith('f_')} for m in o['rows']]
    res = dict(label=label, kw=kw, seed=seed, rows=rows, lorenz=o['lorenz'], summary=o['summary'])
    if 'traj' in o:
        res['traj'] = o['traj']
    return res


def sets():
    S = {}
    S['e1'] = [(f"R={R} feast={fe}", dict(R=R, feasting=fe), range(4)) for R in (1.2, 1.67, 2.0) for fe in (True, False)]
    S['e2base'] = [("base", dict(L, _track=True), range(8))]
    sens = dict(R=(1.2, 2.0), weather_sd=(0.1, 0.3), disaster_p=(0.0, 0.16), hh_sd=(0.05, 0.3), interest=(0.1, 0.5),
                reserve=(0.25, 1.0), floor_days=(10, 40), store_target=(0.5, 2.0), lender_sample=(3, 200),
                lifecycle=(False,), feasting=(False,), kin_help=(False,), case_min_debt=(30, 120), default_after=(1, 3))
    S['e2sens'] = [(f"{k}={v}", dict(L, **{k: v}), range(4)) for k, vs in sens.items() for v in vs]
    S['regime'] = [(f"R={R} wsd={ws}", dict(L, R=R, weather_sd=ws), range(3))
                   for R in (1.2, 1.4, 1.67, 2.0, 2.4) for ws in (0.05, 0.15, 0.25, 0.35)]
    S['e3single'] = ([(f"partible={v}", dict(L, partible=v), range(4)) for v in (0.25, 0.5, 1.0)] +
                     [(f"partible={v} split2", dict(L, partible=v, min_split=2), range(2)) for v in (0.5,)] +
                     [(f"leave={v}", dict(L, leave_p=v), range(4)) for v in (0.1, 0.3, 0.6)] +
                     [(f"politics={v}", dict(L, politics=v), range(4)) for v in (0.4, 0.3, 0.2, 0.15)])
    S['e3combo'] = [(f"partible={pa} politics={po} leave={le}", dict(L, partible=pa, politics=po, leave_p=le), range(3))
                    for pa in (0, 0.5, 1.0) for po in (None, 0.3, 0.2) for le in (0, 0.3)]
    S['e4'] = [("goodwill on", dict(L), range(6)), ("no feasting", dict(L, feasting=False), range(6)),
               ("no kin help", dict(L, kin_help=False), range(6)), ("no goodwill", dict(L, feasting=False, kin_help=False), range(6)),
               ("patronage", dict(L, patronage=True, _track=True), range(6)),
               ("patronage, no feasting", dict(L, patronage=True, feasting=False), range(6)),
               ("patronage only (no loans)", dict(loans=False, patronage=True), range(6))]
    S['e5'] = [(f"rent={r} leave={le}", dict(L, rent=r, leave_p=le, collateral=True), range(3)) for r in (0.1, 0.25, 0.4, 0.5, 0.6) for le in (0, 0.3)]
    S['e5open'] = [(f"rent={r}", dict(L, rent=r), range(2)) for r in (0.1, 0.25, 0.4, 0.5, 0.6)]
    S['lc'] = [("lifecycle=False", dict(L, lifecycle=False), range(4)), ("lifecycle=False R=1.2", dict(L, lifecycle=False, R=1.2), range(4)),
               ("lifecycle=False wsd=0.35", dict(L, lifecycle=False, weather_sd=0.35, hh_sd=0.3), range(4)),
               ("collateral", dict(L, collateral=True), range(4))]
    S['e6'] = [(f"lifecycle={lc} R={R} wsd={ws}", dict(L, lifecycle=lc, R=R, weather_sd=ws, hh_sd=hs), range(3))
               for lc in (True, False) for R in (1.67, 2.0) for ws, hs in ((0.1, 0.05), (0.3, 0.3))]
    return S


if __name__ == '__main__':
    os.makedirs('results', exist_ok=True)
    S = sets()
    names = sys.argv[1:] or list(S)
    for name in names:
        jobs = [(name, lab, kw, s) for lab, kw, seeds in S[name] for s in seeds]
        with Pool(4) as p:
            res = p.map(one, jobs, chunksize=1)
        pickle.dump(res, open(f'results/{name}.pkl', 'wb'))
        print(name, len(res), flush=True)
