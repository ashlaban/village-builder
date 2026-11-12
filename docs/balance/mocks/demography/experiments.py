"""Runs the demography mock's experiments; prints numbers, writes results.json and the figures. python3 experiments.py"""
import json, os, sys
import numpy as np
from scipy.optimize import brentq
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from model import Pop, growth, life_stats, tfr, l15, survival, H, kh, AGES

OUT = os.path.dirname(os.path.abspath(__file__))
R = {}
pct = lambda r: round(100 * r, 2)

# ---------------------------------------------------------------- 1. baseline
r0, P0 = growth({})
R['baseline'] = dict(r=pct(r0), doubling=round(np.log(2) / r0, 1), births_per_woman_married_18_to_50=round(tfr(18), 2),
                     l15=round(l15(), 3), game_today_r=pct(np.log(2) / 40), vision_r=pct(np.log(100) / 150))
# births per woman born (cohort): sum over ages of survival to age x married share x rate
s, half = survival()
lx = half * np.concatenate([[1], np.cumprod(s[:-1])])
from model import asfr
R['baseline']['births_per_woman_born'] = round(float((lx * asfr(18)).sum()), 2)
R['baseline']['births_per_woman_reaching_18'] = round(float((lx[18:] / lx[18] * asfr(18)[18:]).sum()), 2)
print('baseline', R['baseline'])


def dr(p):
    return pct(growth(p)[0] - r0)


# ---------------------------------------------------------------- 2. lever ranges
L = {}
L['marriage age 18 to 28'] = {a: dr(dict(marry_age=a)) for a in (18, 20, 22, 25, 28)}
L['never married 0 to 35%'] = {n: dr(dict(q=1 - n)) for n in (0, 0.1, 0.2, 0.35)}
L['nursing 0.5 to 2.5 y'] = {y: dr(dict(nursing=int(48 * y))) for y in (0.5, 1, 1.5, 2, 2.5)}
L['nursing 0.5 to 2.5 y, infant death ends it'] = {y: dr(dict(nursing=int(48 * y), infant_end=True)) for y in (0.5, 1, 1.5, 2, 2.5)}
L['chronic hunger 0 to 0.49'] = {h: dr(dict(h=h)) for h in (0, 0.1, 0.2, 0.3, 0.4, 0.49)}
L['chronic hunger 0.5 (marriage stops)'] = {0.5: dr(dict(h=0.5))}


def famine_every(T, hf=0.7):
    return lambda N, Nr, t: hf if t % T == T - 1 else 0.0


L['famine year (h 0.7) every 20 to 5 y'] = {T: pct(growth(dict(h=famine_every(T)), years=300, window=100)[0] - r0) for T in (40, 20, 10, 5)}
L['disease x1 to x3, uniform'] = {D: dr(dict(D=D)) for D in (1, 1.5, 2, 3)}
L['disease x1 to x3, crowding at N=100'] = {D: dr(dict(D=1 + (D - 1) * 0.1)) for D in (1, 1.5, 2, 3)}
L['disease x1 to x3, crowding at N=1000'] = L['disease x1 to x3, uniform']


def migr(M, N0, years=10):
    P = Pop({})
    P.run(200)
    P.z *= N0 / P.N()
    base = Pop({}, P.z).run(years)
    Pm = Pop(dict(M=M), P.z).run(years)
    return pct((np.log(Pm.N()) - np.log(base.N())) / years)


L['migration -5 to +5 a year, N=100'] = {M: migr(M, 100) for M in (-5, -2, 0, 2, 5)}
L['migration -5 to +5 a year, N=1000'] = {M: migr(M, 1000) for M in (-5, -2, 0, 2, 5)}
R['levers'] = {k: {str(a): b for a, b in v.items()} for k, v in L.items()}
for k, v in L.items():
    print(f'{k:45s}', v)
R['tfr'] = {f'marry {a}': round(tfr(a), 2) for a in (18, 20, 22, 25, 28)}
R['tfr'].update({f'nursing {y}y': round(tfr(18, nursing=int(48 * y)), 2) for y in (0.5, 1, 2.5)})
R['tfr'].update({f'nursing {y}y infant ends': round(tfr(18, nursing=int(48 * y), infant_end=True), 2) for y in (0.5, 1, 2.5)})
R['tfr'].update({f'hunger {h}': round(tfr(18, h=h), 2) for h in (0.2, 0.4)})
print('tfr', R['tfr'])

# ---------------------------------------------------------------- 3. recipes for zero growth at 1,000
N0 = 1000


def solve(f, lo, hi):
    return brentq(f, lo, hi, xtol=1e-4)


rec = {}
# A hunger-held: everyone marries at 18; hunger from food fixed at what feeds 1,000 at h*
R['hunger_r_at_049'] = pct(growth(dict(h=0.49))[0])
hA = 0.5  # growth stays positive for every h below the marriage cliff at 0.5 (see levers), so the hunger recipe sits on the cliff
rec['A hunger'] = dict(p=dict(h=lambda N, Nr, t, hs=hA: 1 - (1 - hs) * N0 / N), star=dict(h=hA))
# B marriage-held: no hunger; marry at 18; share marrying gated by homes per head (elasticity 2)
qB = solve(lambda q: growth(dict(q=q))[0], 0.05, 1)
rec['B marriage (18)'] = dict(p=dict(q=lambda N, Nr, t, qs=qB: qs * (N0 / N) ** 2), star=dict(q=qB))
qB2 = solve(lambda q: growth(dict(q=q, marry_age=25))[0], 0.05, 1)
rec['B2 marriage (25)'] = dict(p=dict(marry_age=25, q=lambda N, Nr, t, qs=qB2: qs * (N0 / N) ** 2), star=dict(q=qB2, marry_age=25))


# C town sink: rural gate on homes, the unmarried go to town, town marries 30%, town deaths x D_town; town 325 of 1,000
def town_case(D, q_town=0.3, marry_age=18):
    q = solve(lambda q: growth(dict(q=q, phi=1, q_town=q_town, D_town=D, marry_age=marry_age))[0], 0.02, 1)
    _, P = growth(dict(q=q, phi=1, q_town=q_town, D_town=D, marry_age=marry_age))
    return q, P.N(1) / P.N(), P


town_grid = {}
for qt in (0.0, 0.3, 0.6):
    rows = []
    for D in (1.0, 1.5, 2, 3, 4, 6):
        try:
            q, share, P = town_case(D, qt)
            st = P.log[-1]
            rows.append(dict(D=D, q_rural=round(q, 3), town_share=round(share, 3), migrants_per_1000=round(1000 * st['migr'] / st['N'], 1)))
        except ValueError:
            rows.append(dict(D=D, q_rural=None, town_share=None))
    town_grid[qt] = rows
    print('town q_town', qt, rows)
R['town_D_for_325'] = {}
for qt in (0.0, 0.3, 0.6):
    try:
        Dq = solve(lambda D: town_case(D, qt)[1] - 0.325, 1.0 if qt < 0.5 else 2.5, 8)
        q, sh, Pq = town_case(Dq, qt)
        ls = life_stats(Pq)
        R['town_D_for_325'][str(qt)] = dict(D_town=round(Dq, 2), migrants_a_year_at_1000=round(1000 * Pq.log[-1]['migr'] / Pq.log[-1]['N'], 1),
                                            town_death_share=round(ls['town_deaths'], 3))
    except ValueError as err:
        R['town_D_for_325'][str(qt)] = str(err)
print('town D for 325', R['town_D_for_325'])
R['town_grid'] = {str(k): v for k, v in town_grid.items()}
Dc = solve(lambda D: town_case(D)[1] - 0.325, 1.0, 6)
qC = town_case(Dc)[0]
rec['C town sink'] = dict(p=dict(phi=1, q_town=0.3, D_town=Dc, q=lambda N, Nr, t, qs=qC: qs * (N0 * 0.675 / Nr) ** 2),
                          star=dict(q=qC, phi=1, q_town=0.3, D_town=Dc))
# D disease-held: crowding disease, multiplier rising with N (D* at 1,000)
DD = solve(lambda D: growth(dict(D=D))[0], 1, 4)
rec['D crowding disease'] = dict(p=dict(D=lambda N, Nr, t, Ds=DD: 1 + (Ds - 1) * (N / N0) ** 2), star=dict(D=DD))


def equilibrate(p, years=500):
    # start from the stable shape of the constant-parameter run, scaled to 1,000, then let the feedback settle
    P = Pop(p)
    P.run(1)
    z = P.z * (N0 / P.N())
    P = Pop(p, z).run(years)
    return P


R['recipes'] = {}
for name, rc in rec.items():
    P = equilibrate(rc['p'])
    ls = life_stats(P)
    st = P.log[-1]
    rc['P'] = P
    R['recipes'][name] = dict(star={k: round(v, 3) for k, v in rc['star'].items()}, N=round(P.N(), 1), town=round(P.N(1), 1),
                              child_death_per_birth=round(ls['child_death'], 3), never_married_at_30=round(ls['never'], 3),
                              town_death_share=round(ls['town_deaths'], 3), births_per_1000=round(1000 * sum(st['births']) / st['N'], 1),
                              h=round(st['h'], 3), q=round(st['q'], 3))
    print(name, R['recipes'][name])

# growth budgets: each recipe's levers applied in order, contribution = change in annual growth (points)
def g(p):
    return pct(growth(p)[0])


bud = {}
bud['A hunger'] = [('biological ceiling', g({})), ('hunger 0.49 on conception', g(dict(hf=0.49, hm=0.0))),
                   ('hunger 0.49 on deaths', g(dict(h=0.49))), ('marriage cliff at 0.5 (flicker)', 0.0)]
bud['B marriage (18)'] = [('biological ceiling', g({})), (f'{1 - qB:.0%} never marry', g(dict(q=qB)))]
bud['B2 marriage (25)'] = [('biological ceiling', g({})), ('marry at 25', g(dict(marry_age=25))), (f'{1 - qB2:.0%} never marry', g(dict(marry_age=25, q=qB2)))]
bud['C town sink'] = [('biological ceiling', g({})), (f'{1 - qC:.0%} of rural never marry', g(dict(q=qC))),
                      ('they go to town (x2.9 deaths, 30% marry)', g(dict(q=qC, phi=1, q_town=0.3, D_town=Dc)))]
bud['D crowding disease'] = [('biological ceiling', g({})), (f'disease x{DD:.2f}', g(dict(D=DD)))]
bud['game today (populous small)'] = [('biological ceiling', g({})), ('later marriage, hunger, ... (not split)', pct(np.log(2) / 40))]
R['budgets'] = bud
print('budgets', bud)

# ---------------------------------------------------------------- 4. the town formula
P = rec['C town sink']['P']
L50 = P.log[-50:]
M = np.mean([s['migr'] for s in L50])
Tn = np.mean([s['Nt'] for s in L50])
b = np.mean([s['births'][1] for s in L50]) / Tn
d = np.mean([s['deaths'][1] for s in L50]) / Tn
br = np.mean([s['births'][0] for s in L50]) / np.mean([s['Nr'] for s in L50])
dr_ = np.mean([s['deaths'][0] for s in L50]) / np.mean([s['Nr'] for s in L50])
naive = M / (Dc * dr_ - 0.3 * br)
# fill time: a town from empty, fed the same migrants (rural part held at its equilibrium shape)
z = P.z.copy()
z[1] = 0
Pf = Pop(dict(rec['C town sink']['p']), z)
fill = []
for t in range(200):
    Pf.z[0] = P.z[0]
    Pf.step()
    fill.append(Pf.N(1))
fill = np.array(fill)
t90 = int(np.argmax(fill >= 0.9 * Tn))
R['town_formula'] = dict(D_town=round(Dc, 2), migrants_a_year=round(M, 1), town=round(Tn, 1), town_b=round(1000 * b, 1), town_d=round(1000 * d, 1),
                         M_over_d_minus_b=round(M / (d - b), 1), naive_from_rural_rates=round(naive, 1), rural_b=round(1000 * br, 1),
                         rural_d=round(1000 * dr_, 1), years_to_90pct_from_empty=t90, one_over_d_minus_b=round(1 / (d - b), 1))
print('town formula', R['town_formula'])

# ---------------------------------------------------------------- 5. lags: a famine killing 15%
T0 = 50


def famine_kill(z, share=0.15):
    a = np.arange(AGES) + 0.5
    w = H(a) * kh(a)
    n = z.sum(axis=(0, 1))
    c = brentq(lambda c: (n * np.minimum(0.9, c * w)).sum() / n.sum() - share, 0, 100)
    return np.minimum(0.9, c * w)


R['lags'] = {}
traj = {}
for name, rc in rec.items():
    base = rc['p']
    hb = base.get('h', 0.0)
    p = dict(base)
    p['h'] = (lambda N, Nr, t, hb=hb: max(hb(N, Nr, t) if callable(hb) else hb, 0.7 if t == T0 else 0.0))
    Pq = Pop(p, rc['P'].z)
    Neq = rc['P'].N()
    for t in range(400):
        Pq.step(shock=famine_kill(Pq.z) if t == T0 else None)
    N = np.array([s['N'] for s in Pq.log]) / Neq
    post = N[T0 + 1:]
    back = np.where(np.abs(post - 1) > 0.02)[0]
    ret = int(back[-1] + 1) if len(back) else 0
    first = int(np.argmax(post >= 0.98)) if (post >= 0.98).any() else None
    traj[name] = N
    # oscillation: count of crossings of 1 after first reaching it
    # swings: times the deviation passes from below -1% to above +1% or back (hysteresis, so noise on the cliff is not counted)
    cross, side = 0, -1
    for v in post:
        if side < 0 and v > 1.01: cross, side = cross + 1, 1
        elif side > 0 and v < 0.99: cross, side = cross + 1, -1
    R['lags'][name] = dict(low=round(float(post.min()), 3), years_to_98pct=first, years_to_stay_within_2pct=ret,
                           overshoot=round(float(post.max() - 1), 3), swings_past_1pct=cross)
    print(name, R['lags'][name])
# no feedback: baseline growth just resumes
json.dump(R, open(os.path.join(OUT, 'results.json'), 'w'), indent=1, default=float)
np.save(os.path.join(OUT, 'traj.npy'), traj, allow_pickle=True)
import pickle
pickle.dump(dict(bud=bud, R=R, traj=traj, pyr={k: v['P'].z for k, v in rec.items()}, fill=fill, Tn=Tn, T0=T0), open(os.path.join(OUT, 'figdata.pkl'), 'wb'))
