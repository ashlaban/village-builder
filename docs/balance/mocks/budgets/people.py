"""People account: a three-class female cohort model (farm F, town T, elite E), yearly, at the game's numbers.

Throwaway research code (round 2, budgets). Reuses survival() and asfr() of ../demography/model.py, which solve the game's
death hazard, hunger multipliers, conception chain, pregnancy and nursing exactly. Women only; people = 2 x women.

Flows at the marriage decision (each cohort decides once, at its marriage age):
  F: a share q_F marry on the farm; of the rest, e_out leave the island, phi go to town, the rest stay single on the farm.
  E: a share q_E marry within the elite; the rest go to town (younger sons and daughters into service, clergy).
  T: a share q_T of the single marry in town (migrants included).
Plus proportional rates: F -> E (a lender becomes landed, u), E -> T (an estate fails, dn), immigration into T and E
(a merchant, an elite with a retinue) as persons a year per 1,000 living. All linear, so the model has a stable growth rate
and stable shares; the solver finds the parameters that make growth zero at 600 / 325 / 75.
"""
import os, sys
import numpy as np
from scipy.optimize import fsolve, brentq

HERE = os.path.dirname(os.path.abspath(__file__))
sys.path.insert(0, os.path.join(HERE, '..', 'demography'))
from model import survival, asfr, CHILDBED, GIRL, AGES  # noqa: E402

F, T, E = 0, 1, 2
CLS = ('farm', 'town', 'elite')
TARGET = np.array([600, 325, 75]) / 1000

# Target budget A. Source tags: G = game rule, M = measured (round 1), D = design number, I = invented here.
BASE = dict(
    marry_F=23,     # I  women's first marriage on farms (measured today 20-21 with almost no delay pressure)
    marry_T=24,     # I  town
    marry_E=20,     # I  elite marry early
    q_F=0.80,       # solved: share of farm women who marry (the rest are the "never married" brake)
    q_T=0.40,       # I  share of single town women who marry
    q_E=0.70,       # solved: share of elite daughters married within the elite (rest placed in town)
    phi=0.85,       # I  share of unmarried farm women who go to town (the rest stay single on the farm)
    e_out=0.10,     # I  share of unmarried farm women who leave the island (emigration brake)
    h_F=0.05,       # I  mean farm hunger (0..1)
    h_T=0.05,       # I  mean town hunger
    D=1.15,         # I  disease: all-class mortality multiplier
    D_town=2.0,     # solved: extra town mortality multiplier (crowding)
    u=0.0005,       # I  F -> E a year (a lender becomes landed: ~0.3 people a year, the estates mock's slow ratchet)
    dn=0.004,       # I  E -> T a year (an estate fails: one household in ~20 years)
    imm_T=1.0,      # D/I immigrants into town per 1,000 living a year (a merchant family every few years)
    imm_E=0.5,      # D/I immigrants into the elite per 1,000 a year (an elite with retinue once a decade)
    nursing=48,     # G
)

CEILING = dict(BASE, marry_F=18, marry_T=18, marry_E=18, q_F=1.0, q_T=1.0, q_E=1.0, phi=0.0, e_out=0.0, h_F=0.0, h_T=0.0,
               D=1.0, D_town=1.0, u=0.0, dn=0.0, imm_T=0.0, imm_E=0.0)


def _rd(x, k):
    return round(float(x) * k) / k


def class_rates(p):
    """Per class: survival s (3 x AGES, by marital state), half-year infant survival, births by age of a married woman."""
    out = []
    for c in (F, T, E):
        h = (p['h_F'], p['h_T'], 0.0)[c]
        D = p['D'] * (p['D_town'] if c == T else 1.0)
        am = (p['marry_F'], p['marry_T'], p['marry_E'])[c]
        s, half = survival(_rd(h, 1e4), _rd(D, 1e5))
        b = asfr(int(am), _rd(h, 1e4), p['nursing'], False, _rd(D, 1e5))
        out.append((s, half, b, am))
    return out


def step(z, p, R, log=None):
    """One year. z[c, state(U,S,M), age] women. Returns the new z; fills log (people a year) if given."""
    N = 2 * z.sum()
    new = np.zeros_like(z)
    L = dict(births=np.zeros(3), deaths=np.zeros(3), under15=np.zeros(3), marriages=np.zeros(3),
             FtoT=0.0, EtoT=0.0, out=0.0, FtoE=0.0, inT=0.0, inE=0.0)
    for c in (F, T, E):
        s, half, b, am = R[c]
        births = (z[c, 2] * b).sum()
        sm = s * (1 - CHILDBED * b)
        surv = np.stack([s, s, sm])
        alive = z[c] * surv
        L['births'][c] = births * 2 * GIRL  # the mirrored population: twice the girls
        L['deaths'][c] = 2 * (z[c].sum() - alive.sum()) + births * 2 * GIRL * (1 - half)
        L['under15'][c] = 2 * (z[c, :, :15] * (1 - surv[:, :15])).sum() + births * 2 * GIRL * (1 - half)
        new[c, :, 1:] = alive[:, :-1]
        new[c, 0, 0] = births * GIRL * half  # births counts both sexes; girls surviving to the census
    # marriage decisions
    for c in (F, T, E):
        am = R[c][3]
        U = new[c, 0, am:].copy()
        new[c, 0, am:] = 0
        q = (p['q_F'], p['q_T'], p['q_E'])[c]
        new[c, 2, am:] += q * U
        L['marriages'][c] += q * U.sum()
        rest = (1 - q) * U
        if c == F:
            gone = p['e_out'] * rest
            mig = p['phi'] * rest
            L['out'] += 2 * gone.sum()
            L['FtoT'] += 2 * mig.sum()
            new[F, 1, am:] += rest - gone - mig
            new[T, 2, am:] += p['q_T'] * mig
            new[T, 1, am:] += (1 - p['q_T']) * mig
            L['marriages'][T] += p['q_T'] * mig.sum()
        elif c == E:
            L['EtoT'] += 2 * rest.sum()
            new[T, 2, am:] += p['q_T'] * rest
            new[T, 1, am:] += (1 - p['q_T']) * rest
            L['marriages'][T] += p['q_T'] * rest.sum()
        else:
            new[T, 1, am:] += rest
    # proportional class moves
    mvFE = p['u'] * new[F]
    mvET = p['dn'] * new[E]
    new[F] -= mvFE
    new[E] += mvFE - mvET
    new[T] += mvET
    L['FtoE'] = 2 * mvFE.sum()
    L['EtoT'] += 2 * mvET.sum()
    # immigration: married couples aged 25 (wife), with their children folded into the age 25 entry for simplicity
    for c, key in ((T, 'imm_T'), (E, 'imm_E')):
        add = p[key] / 1000 * N / 2
        new[c, 2, 25] += add
        L['inT' if c == T else 'inE'] = 2 * add
    if log is not None:
        log.append(L)
    return new


def start():
    s, half = survival()
    l = np.concatenate([[1], np.cumprod(s[:-1])])
    z = np.zeros((3, 3, AGES))
    for c, share in zip((F, T, E), TARGET):
        z[c, 2, 20:] = share * 500 * l[20:] / l.sum()
        z[c, 0, :20] = share * 500 * l[:20] / l.sum()
    return z


def run(p, years=500, z=None):
    """Runs to the stable state, renormalising to 1,000 each year. Returns r, shares, z (1,000 living), log of the last year."""
    R = class_rates(p)
    z = start() if z is None else z.copy()
    rs = []
    for t in range(years):
        n0 = z.sum()
        z = step(z, p, R)
        rs.append(np.log(z.sum() / n0))
        z *= 500 / z.sum()
    log = []
    step(z, p, R, log)
    shares = z.sum(axis=(1, 2)) / z.sum()
    return float(np.mean(rs[-30:])), shares, z, log[0]


def solve(p, free=('q_F', 'D_town', 'q_E'), years=400):
    """Finds the free parameters so that growth is zero and shares are 600 / 325 / 75."""
    p = dict(p)

    LIM = dict(q_F=(0, 1), q_E=(0, 1), q_T=(0, 1), phi=(0, 1), D_town=(0.2, 20), h_F=(0, 0.49), h_T=(0, 0.49))

    def clip(k, v):
        lo, hi = LIM.get(k, (-1e9, 1e9))
        return float(min(hi, max(lo, v)))

    def f(x):
        q = dict(p, **{k: clip(k, v) for k, v in zip(free, x)})
        r, sh, _, _ = run(q, years)
        return [100 * r, sh[T] - TARGET[T], sh[E] - TARGET[E]]

    x, info, ier, msg = fsolve(f, [p[k] for k in free], full_output=True, epsfcn=1e-4)
    p.update({k: clip(k, v) for k, v in zip(free, x)})
    res = f(x)
    return p, res


def account(p, years=500):
    """The yearly people account at 1,000 living, by class."""
    r, sh, z, L = run(p, years)
    rows = {}
    for c in (F, T, E):
        pop = 2 * z[c].sum()
        ages = 2 * z[c].sum(axis=0)
        rows[CLS[c]] = dict(stock=pop, births=L['births'][c], deaths=L['deaths'][c], under15_deaths=L['under15'][c],
                            marriages=L['marriages'][c], children=ages[:15].sum(), adults=ages[15:].sum(),
                            workers=ages[15:60].sum(), elders=ages[60:].sum(),
                            units=ages[:15].sum() * 0.5 + ages[15:].sum(),
                            never_married_45=z[c, 1, 45:50].sum() / max(1e-9, z[c, :, 45:50].sum()))
    rows['flows'] = dict(farm_to_town=L['FtoT'], elite_to_town=L['EtoT'], farm_to_elite=L['FtoE'], farm_out=L['out'],
                         in_town=L['inT'], in_elite=L['inE'])
    for c in CLS:
        d = rows[c]
        i = CLS.index(c)
        inflow = (L['FtoT'] + L['EtoT'] + L['inT']) if i == T else (L['FtoE'] + L['inE']) if i == E else 0.0
        outflow = (L['FtoT'] + L['FtoE'] + L['out']) if i == F else L['EtoT'] if i == E else 0.0
        d['in'] = inflow
        d['out'] = outflow
        d['net'] = d['births'] - d['deaths'] + inflow - outflow
    births = sum(rows[c]['births'] for c in CLS)
    rows['total'] = dict(r=r, births=births, deaths=sum(rows[c]['deaths'] for c in CLS),
                         child_deaths_per_birth=sum(rows[c]['under15_deaths'] for c in CLS) / births,
                         never_married_45=float(z[:, 1, 45:50].sum() / z[:, :, 45:50].sum()),
                         town_death_share=rows['town']['deaths'] / sum(rows[c]['deaths'] for c in CLS),
                         e0=1000 / births)
    return rows


def growth(p, years=400):
    return run(p, years)[0]
