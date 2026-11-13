"""Round 2 budgets experiment: solves the target, builds the six accounts, the growth budget and its alternatives,
perturbs ten dials by +-20%, and writes results.json and CSVs. python3 experiment.py  (about a minute)"""
import itertools, json, math, os, csv
import numpy as np
import people as PP
import accounts as A

OUT = os.path.dirname(os.path.abspath(__file__))
R = {}


def rnd(x, n=3):
    if isinstance(x, dict):
        return {k: rnd(v, n) for k, v in x.items()}
    if isinstance(x, (list, tuple)):
        return [rnd(v, n) for v in x]
    if isinstance(x, (float, np.floating)):
        return round(float(x), n)
    return x


# ------------------------------------------------------------------ 1. people: target budget A
pA, res = PP.solve(PP.BASE)
pplA = PP.account(pA)
R['people_A'] = dict(params={k: pA[k] for k in PP.BASE}, solve_residual=res, account=pplA)
print('A solved', {k: round(pA[k], 3) for k in ('q_F', 'D_town', 'q_E')})

# growth budget: Shapley split of the ceiling (2.40%) among six brakes, from the ceiling to budget A
BRAKES = {
    'marriage delay': dict(marry_F=pA['marry_F'], marry_T=pA['marry_T'], marry_E=pA['marry_E']),
    'never marrying': dict(q_F=pA['q_F'], q_E=pA['q_E']),
    'hunger': dict(h_F=pA['h_F'], h_T=pA['h_T']),
    'disease': dict(D=pA['D']),
    'town (migration, marriage, deaths)': dict(phi=pA['phi'], q_T=pA['q_T'], D_town=pA['D_town']),
    'net migration (out of island, in)': dict(e_out=pA['e_out'], imm_T=pA['imm_T'], imm_E=pA['imm_E']),
}
CLASSMOVES = dict(u=pA['u'], dn=pA['dn'])


def shapley(brakes, base_off, years=350):
    names = list(brakes)
    n = len(names)
    cache = {}
    for mask in range(1 << n):
        p = dict(base_off, **CLASSMOVES)
        for i in range(n):
            if mask >> i & 1:
                p.update(brakes[names[i]])
        cache[mask] = PP.growth(p, years)
    phi = {}
    for i, nm in enumerate(names):
        v = 0.0
        for mask in range(1 << n):
            if mask >> i & 1:
                continue
            k = bin(mask).count('1')
            w = math.factorial(k) * math.factorial(n - k - 1) / math.factorial(n)
            v += w * (cache[mask] - cache[mask | 1 << i])  # growth removed by adding brake i
        phi[nm] = v
    alone = {nm: cache[0] - cache[1 << i] for i, nm in enumerate(names)}
    last = {nm: cache[(1 << n) - 1 - (1 << i)] - cache[(1 << n) - 1] for i, nm in enumerate(names)}
    return cache[0], cache[(1 << n) - 1], phi, alone, last


def human(ppl, p):
    t = ppl['total']
    return dict(child_deaths_per_birth=t['child_deaths_per_birth'], never_married_45=t['never_married_45'],
                e0=t['e0'], town_death_share=t['town_death_share'], D_town=p['D_town'], hunger=p['h_F'],
                farm_women_marrying=p['q_F'], migrants_to_town=ppl['flows']['farm_to_town'] + ppl['flows']['elite_to_town'],
                emigrants=ppl['flows']['farm_out'], marry_F=p['marry_F'], births=t['births'])


ceil, end, shap, alone, last = shapley(BRAKES, PP.CEILING)
R['growth_budget_A'] = dict(ceiling=ceil, end=end, shapley=shap, alone=alone, last=last, human=human(pplA, pA))
print('growth budget A', rnd(R['growth_budget_A'], 4))

# alternatives
ALT = {
    'B hunger-held (marry 20, almost all marry)': (dict(PP.BASE, marry_F=20, marry_T=21, marry_E=18, D=1.0),
                                                  ('h_F', 'D_town', 'q_E')),
    'C late marriage (26, no hunger)': (dict(PP.BASE, marry_F=26, marry_T=26, marry_E=22, h_F=0.0, h_T=0.0, D=1.0),
                                        ('q_F', 'D_town', 'q_E')),
    'D town graveyard (marry 20, town marries 60%)': (dict(PP.BASE, marry_F=20, marry_T=20, q_T=0.6, phi=0.95, e_out=0.0,
                                                           h_F=0.02, h_T=0.05, D=1.0), ('q_F', 'D_town', 'q_E')),
    'E emigration valve (marry 21, 60% of the unmarried leave)': (dict(PP.BASE, marry_F=21, e_out=0.6, phi=0.35, h_F=0.02,
                                                                       h_T=0.05, D=1.0), ('q_F', 'D_town', 'q_E')),
}
R['alternatives'] = {}
for nm, (p0, free) in ALT.items():
    if 'h_F' in free:
        # hunger is one dial for farm and town
        def solve_h(p0=p0):
            # hunger (farm and town alike) is the residual brake; 95% of farm women marry
            from scipy.optimize import fsolve
            def mk(x):
                h = float(min(0.49, max(0.0, x[0])))
                return dict(p0, q_F=0.95, h_F=h, h_T=h, D_town=float(max(0.2, x[1])), q_E=float(min(1, max(0, x[2]))))
            def f(x):
                r, sh, _, _ = PP.run(mk(x), 400)
                return [100 * r, sh[1] - PP.TARGET[1], sh[2] - PP.TARGET[2]]
            x = fsolve(f, [0.3, 1.0, 0.3], epsfcn=1e-4)
            return mk(x), f(x)
        p, rs = solve_h()
    else:
        p, rs = PP.solve(p0, free=free)
    ppl = PP.account(p)
    br = {k: {kk: p[kk] for kk in v} for k, v in BRAKES.items()}
    c, e, sh, al, la = shapley(br, PP.CEILING)
    R['alternatives'][nm] = dict(params={k: p[k] for k in PP.BASE}, residual=rs, shapley=sh, human=human(ppl, p),
                                 valid=bool(0 <= p['q_F'] <= 1 and 0 <= p['q_E'] <= 1 and p['D_town'] > 0))
    print(nm, rnd(R['alternatives'][nm]['human']), 'valid', R['alternatives'][nm]['valid'])

# ------------------------------------------------------------------ 2-6. the accounts at the target
base = A.accounts(A.PAR, pplA)
P0 = base['p']  # with sold solved
R['accounts'] = base
print('margins', rnd(base['margins']))


def acc(p, ppl=pplA):
    return A.accounts(p, ppl, solve_sold=False)


# today's measured split of the farm's gross produce (grain split of measure/tables.md, populous y20-50)
f = base['food']
gg, other, gross = f['grain_gross'], f['other'], f['gross']
today = dict(seed=0.34 * gg, rot=0.22 * gg, ale=0.08 * gg, farm_eaten=f['farm_eaten'])
today['unused'] = gross - sum(today.values())
R['food_today'] = dict(split=today, rot_share_of_P=today['rot'] / f['P'], unused_share_of_P=today['unused'] / f['P'])
target_split = dict(seed=f['seed'], farm_eaten=f['farm_eaten'], rot=f['rot'], tithe=f['tithe'], rent=f['rent'],
                    tax_interest=f['tax'] + f['interest'], tolls=f['toll_farm'], sold=f['sold'], feast=f['feast'])
R['food_target'] = dict(split=target_split, check=gross - sum(target_split.values()))


# R required: the smallest R that feeds the town with everything sold (sold = 1), and with half the surplus feasted
def R_needed(sold_share, rot):
    lo, hi = 1.0, 4.0
    for _ in range(60):
        mid = (lo + hi) / 2
        a = acc(dict(P0, R=mid, rot=rot, sold=sold_share))
        lo, hi = (mid, hi) if a['margins']['town'] < 0 else (lo, mid)
    return hi


R['R_needed'] = {f'sold {s}, rot {r}': R_needed(s, r) for s in (1.0, 0.5) for r in (0.03, 0.175)}
# the R ladder: what each claim adds to the farm's own need (1.0)
fn = f['farm_eaten']
e = base['elite']
ladder = dict(farm=1.0, town=(f['town_need'] - f['retinue_fed_by_elite'] - f['town_own'] + f['toll_town']) / fn,
              elite=(e['requirement'] - f['demesne_net'] - f['toll_town']) / fn, rot=f['rot'] / fn,
              town_reserve=0.05 * (f['town_need'] - f['retinue_fed_by_elite'] - f['town_own'] + f['toll_town']) / fn)
ladder['feast_and_elite_slack'] = f['R_effective'] - sum(ladder.values())
R['R_ladder'] = ladder
print('R needed', rnd(R['R_needed']), 'ladder', rnd(ladder))

# today's rot at the target
R['target_at_today_rot'] = acc(dict(P0, rot=0.175))['margins']

# elite options: how to feed 13.5 households
opts = {
    'rent only': dict(tithe=0, tax=0, interest=0, toll=0, demesne_hh=0),
    'rent + demesne (owed days, hired hands)': dict(tithe=0, tax=0, interest=0, toll=0),
    'design mix without the tithe (Church apart)': dict(tithe=0),
    'design mix (tithe, tax, interest, tolls, demesne)': dict(),
}
R['elite_options'] = {}
for nm, d in opts.items():
    a = A.accounts(dict(A.PAR, **d, elite_reserve=0.0), pplA, solve_tenants=True)
    el = a['elite']
    R['elite_options'][nm] = dict(tenant_fields=el['tenant_fields'], per_hh=el['tenant_fields_per_hh'], tenancy=el['tenancy_share'],
                                  rent_share_of_output=el['rent_share_of_output'], taken_share=el['taken_share_of_output'],
                                  tenant_margin=a['margins']['tenant'], income=el['income'])
R['tithe_only_rate'] = e['requirement'] / f['gross']
print('elite options', rnd({k: (v['tenant_fields'], v['tenancy'], v['rent_share_of_output']) for k, v in R['elite_options'].items()}))

# ------------------------------------------------------------------ 7. perturbation of ten dials
DIALS = {
    'yield (seed:yield)': ('seed_yield', None),
    'fields per household': ('fields_hh', None),
    'share rotted': ('rot', None),
    'tithe': ('tithe', None),
    'rent share': ('rent', None),
    'share sold': ('sold', None),
    'elite household size': ('elite', None),
    'town mortality': ('D_town', 'people'),
    'marriage age (farm women)': ('marry_F', 'people'),
    'walking time': ('walk_share', None),
}
_people_cache = {}


def people_at(key, m):
    k = (key, round(m, 3))
    if k not in _people_cache:
        p = dict(pA)
        p[key] = (int(round(pA[key] * m)) if key == 'marry_F' else pA[key] * m)
        r, sh, z, _ = PP.run(p, 400)
        ppl = PP.account(p)
        _people_cache[k] = (r, sh, ppl)
    return _people_cache[k]


def perturb(dial, m):
    key, kind = DIALS[dial]
    if kind == 'people':
        r, sh, ppl = people_at(key, m)
        a = acc(dict(P0), ppl)
        return a, dict(r=r, shares=sh.tolist())
    p = dict(P0)
    if key == 'elite':
        p['elite_mult'] *= m
        p['retinue_hh'] *= m
    elif key == 'sold':
        p['sold'] = min(1.0, P0['sold'] * m)
    else:
        p[key] = P0[key] * m
    return acc(p), None


rows = []
R['perturb'] = {}
for dial in DIALS:
    d = {}
    for m in (0.8, 1.2):
        a, ex = perturb(dial, m)
        mg = a['margins']
        hard = {k: mg[k] for k in A.HARD}
        worst = min(hard, key=hard.get)
        d[str(m)] = dict(margins=mg, worst=worst, worst_margin=hard[worst], people=ex)
        rows.append(dict(dial=dial, change=f'{m - 1:+.0%}', worst=worst, worst_margin=round(hard[worst], 3),
                         **{k: round(v, 3) for k, v in mg.items()},
                         growth_pct=None if ex is None else round(100 * ex['r'], 2),
                         town_share=None if ex is None else round(ex['shares'][1], 3)))
    # slack: the smallest change (1% steps, to +-60%) that sends any hard margin below zero, each direction
    sl = {}
    for sgn in (-1, 1):
        sl[sgn] = None
        for k in range(1, 61):
            m = 1 + sgn * k / 100
            a, ex = perturb(dial, m)
            hard = {kk: a['margins'][kk] for kk in A.HARD}
            if ex is not None and abs(ex['r']) > 0.0025:
                sl[sgn] = (k / 100, 'people (growth > 0.25%/yr)')
                break
            if min(hard.values()) < 0:
                sl[sgn] = (k / 100, min(hard, key=hard.get))
                break
    d['slack'] = {'down': sl[-1], 'up': sl[1]}
    R['perturb'][dial] = d
    print(dial, 'slack', d['slack'], '| -20%:', d['0.8']['worst'], round(d['0.8']['worst_margin'], 3),
          '| +20%:', d['1.2']['worst'], round(d['1.2']['worst_margin'], 3))

with open(os.path.join(OUT, 'perturbation.csv'), 'w', newline='') as fh:
    w = csv.DictWriter(fh, fieldnames=list(rows[0]))
    w.writeheader()
    w.writerows(rows)
with open(os.path.join(OUT, 'parameters.csv'), 'w', newline='') as fh:
    tg = A.tags()
    w = csv.writer(fh)
    w.writerow(['account', 'parameter', 'value', 'source (G game, M measured, D design, R round-1 mock, I invented)'])
    for k, v in A.PAR.items():
        w.writerow(['food/elite/labour/land/goodwill', k, v if not isinstance(v, float) else round(v, 4), tg.get(k, 'solved')])
    srcp = dict(marry_F='I', marry_T='I', marry_E='I', q_F='solved', q_T='I', q_E='solved', phi='I', e_out='I', h_F='I', h_T='I',
                D='I', D_town='solved', u='I', dn='I', imm_T='D/I', imm_E='D/I', nursing='G')
    for k in PP.BASE:
        w.writerow(['people', k, round(pA[k], 4), srcp[k]])
json.dump(rnd(R, 4), open(os.path.join(OUT, 'results.json'), 'w'), indent=1, default=str)
print('written')
