"""Cohort mock of the village builder's demography (throwaway research code, not game code).

Female-only cohort projection, annual steps, ages 0..99, two regions (rural, town).
Women are in one of three states by age: U (single, marriage not yet decided), S (never married), M (married).
Men are assumed always available (the female side drives births); total people = 2 x women.
Fertility of a married woman by age comes from a daily Markov chain of the game's rule
(free -> pregnant 36 days -> nursing N days, conception 0.015*ageFactor*(1-h) a day), solved exactly.
Numbers from src/sim/rules.js, births.js, deaths.js.
"""
from functools import lru_cache
import numpy as np

YEAR_DAYS = 48
AGES = 100
PEAK, AGEF, B_FROM, B_TO = 0.015, [0.89, 1, 0.94, 0.86, 0.7, 0.36, 0.05], 15, 50
PREG = 36
GIRL = 100 / 205
CHILDBED = 0.01


def H(a):
    a = np.asarray(a, float)
    return 0.006 + 0.0007 * np.exp(0.07 * a) + 0.381 * np.exp(-1.265 * a)


def kh(a):
    a = np.asarray(a, float)
    return np.where((a < 5) | (a >= 60), 1.5, np.where(a < 15, 0.6, 0.3))


def hazard(a, h=0.0, D=1.0):
    return H(a) * (1 + kh(a) * h) * D


_X = np.linspace(0, 1, 41)


@lru_cache(maxsize=None)
def survival(h=0.0, D=1.0):
    """s[a]: chance to live from exact age a to a+1; half: from birth to age 0.5."""
    s = np.empty(AGES)
    for a in range(AGES):
        x = a + 0.5 + _X  # census ages are mid-year: class a holds ages a..a+1, survival from a+0.5 to a+1.5
        s[a] = np.exp(-np.trapezoid(hazard(x, h, D), x))
    xh = np.linspace(0, 0.5, 41)
    half = np.exp(-np.trapezoid(hazard(xh, h, D), xh))
    return s, half


def cond(a):
    return 0.0 if a < B_FROM or a >= B_TO else PEAK * AGEF[(a - B_FROM) // 5]


@lru_cache(maxsize=None)
def asfr(marry_age=18, h=0.0, nursing=48, infant_end=False, D=1.0):
    """Births a year to a woman married (and her husband living) from marry_age, by age 0..99, exact daily chain."""
    out = np.zeros(AGES)
    free = 1.0
    preg = np.zeros(PREG)        # preg[k]: k days pregnant so far
    nurs = np.zeros(max(nursing, 1))  # nurs[j]: j days nursing so far
    # infant daily death chance at age j days (j/48 years), used if an infant's death ends nursing
    jd = np.arange(len(nurs))
    q_inf = 1 - np.exp(-hazard(jd / YEAR_DAYS, h, D) / YEAR_DAYS) if infant_end else np.zeros(len(nurs))
    for d in range(marry_age * YEAR_DAYS, B_TO * YEAR_DAYS + PREG):
        a = d // YEAR_DAYS
        c = cond(a) * (1 - h)
        born = preg[-1]
        if a < AGES:
            out[a] += born
        # nursing advances; ends after `nursing` days, or early at the infant's death
        if nursing > 0:
            ended = nurs[-1]
            died = nurs[:-1] * q_inf[:-1]
            stay = nurs[:-1] - died
            new_n = np.empty_like(nurs)
            new_n[0] = born
            new_n[1:] = stay
            free += ended + died.sum() + (nurs[-1] * 0)
        else:
            free += born
            new_n = nurs
        preg[1:] = preg[:-1].copy()
        preg[0] = free * c
        free -= preg[0]
        nurs = new_n
    return out


def tfr(marry_age=18, h=0.0, nursing=48, infant_end=False, D=1.0, ever=1.0):
    """Births a woman married from marry_age who lives to 50 (no own death)."""
    return ever * asfr(marry_age, h, nursing, infant_end, D).sum()


class Pop:
    """Two-region female cohort projection. p is a dict of parameters; callables of the state allowed for feedbacks."""

    def __init__(self, p, F0=None):
        self.p = dict(DEFAULTS, **p)
        z = np.zeros((2, 3, AGES))  # region (0 rural, 1 town), state (U,S,M), age
        if F0 is None:
            s, _ = survival()
            l = np.concatenate([[1], np.cumprod(s[:-1])])
            z[0, 0] = 50 * l / l.sum()  # 100 people, a life-table shape, all single
            am = self.p['marry_age']
            ever = self.p['q'] if not callable(self.p['q']) else 1.0
            z[0, 2, am:] = z[0, 0, am:] * ever
            z[0, 1, am:] = z[0, 0, am:] * (1 - ever)
            z[0, 0, am:] = 0
        else:
            z = F0.copy()
        self.z = z
        self.t = 0
        self.log = []

    def N(self, r=None):
        return 2 * (self.z.sum() if r is None else self.z[r].sum())

    def step(self, shock=None):
        p, z = self.p, self.z
        Nr, Nt, N = self.N(0), self.N(1), self.N()
        h = p['h'](N, Nr, self.t) if callable(p['h']) else p['h']
        h = float(np.clip(h, 0, 0.99))
        hq = round(h * 200) / 200
        Dr = p['D'](N, Nr, self.t) if callable(p['D']) else p['D']
        Dt = Dr * p['D_town']
        q_r = p['q'](N, Nr, self.t) if callable(p['q']) else p['q']
        q_r = float(np.clip(q_r, 0, 1))
        new = np.zeros_like(z)
        stats = dict(t=self.t, N=N, Nr=Nr, Nt=Nt, h=h, q=q_r, births=[0, 0], deaths=[0, 0], under15=[0, 0], migr=0.0)
        for r, D in ((0, round(Dr, 3)), (1, round(Dt, 3))):
            hm = p['hm'] if p.get('hm') is not None else hq  # optional: hunger on deaths only / on conception only
            hf = p['hf'] if p.get('hf') is not None else hq
            s, half = survival(hm, D)
            b = asfr(p['marry_age'], hf, p['nursing'], p['infant_end'], D)
            births = (z[r, 2] * b).sum()
            stats['births'][r] = births
            sm = s * (1 - CHILDBED * b)
            surv = np.stack([s, s, sm])
            alive = z[r] * surv
            dead = z[r].sum() - alive.sum()
            girls0 = births * GIRL * half
            stats['deaths'][r] = 2 * dead + births * (1 - half)  # women and men, plus infants dead before census
            stats['under15'][r] = 2 * (z[r, :, :15] * (1 - surv[:, :15])).sum() + births * (1 - half)
            new[r, :, 1:] = alive[:, :-1]
            new[r, 0, 0] = girls0
        if shock is not None:
            new *= (1 - shock)[None, None, :]
        # marriage decisions for single women at or past the marriage age (none in a year of hunger >= 0.5)
        am = p['marry_age']
        if h < 0.5:
            for r in (0, 1):
                U = new[r, 0, am:].copy()
                new[r, 0, am:] = 0
                q = q_r if r == 0 else p['q_town']
                new[r, 2, am:] += q * U
                rest = (1 - q) * U
                if r == 0:
                    mig = p['phi'] * rest  # the unmarried go to town, where they may marry
                    stats['migr'] = 2 * mig.sum()
                    new[1, 2, am:] += p['q_town'] * mig
                    new[1, 1, am:] += (1 - p['q_town']) * mig
                    new[r, 1, am:] += rest - mig
                else:
                    new[r, 1, am:] += rest
        # fixed migration, persons a year, as young adults aged 20 (married like the rest); negative removes
        M = p['M']
        if M:
            a = 20
            if M > 0:
                new[0, 2, a] += M / 2 * (p['q'] if not callable(p['q']) else 1.0)
                new[0, 1, a] += M / 2 * (1 - (p['q'] if not callable(p['q']) else 1.0))
            else:
                tot = new[0, :, 18:26].sum()
                if tot > 0:
                    new[0, :, 18:26] *= max(0, 1 + M / 2 / tot)
        self.z = new
        self.t += 1
        self.log.append(stats)
        return stats

    def run(self, years, shocks=None):
        for _ in range(years):
            self.step(None if shocks is None else shocks.get(self.t))
        return self


DEFAULTS = dict(h=0.0, D=1.0, D_town=1.0, q=1.0, q_town=1.0, phi=0.0, marry_age=18, nursing=48, infant_end=False,
                ever=1.0, M=0.0)


def growth(p, years=300, window=50, start=None):
    """Long-run annual growth rate (log) of a constant-parameter run."""
    P = Pop(p, start).run(years)
    Ns = [s['N'] for s in P.log]
    return np.log(Ns[-1] / Ns[-1 - window]) / window, P


def l15(h=0.0, D=1.0):
    s, half = survival(round(h * 200) / 200, D)
    return half * np.prod(s[:14]) * np.exp(-0.5 * 0)  # birth to age 14.5, near enough to 15


def life_stats(P, last=50):
    """Human costs over the last `last` years of a run: child deaths per birth, never-married share of women at 30, town death share."""
    L = P.log[-last:]
    births = sum(sum(s['births']) for s in L)
    u15 = sum(sum(s['under15']) for s in L)
    deaths = sum(sum(s['deaths']) for s in L)
    town_d = sum(s['deaths'][1] for s in L)
    z = P.z
    w30 = z[:, :, 30].sum()
    never = z[:, 1, 30].sum() / w30 if w30 > 0 else np.nan
    return dict(child_death=u15 / births if births else np.nan, never=never, town_deaths=town_d / deaths if deaths else 0)
