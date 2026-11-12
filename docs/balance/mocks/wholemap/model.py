"""Aggregate stock-and-flow model of the whole draft-3 balance map (yearly steps).

Units: people; food in need-units (one adult's year of rations = 48 rations); land in fields.
Every term is tagged with the draft-3 arrow it implements (see ARROWS in arrows.py).
Throwaway research code.
"""
import math
import numpy as np
class norm:
    @staticmethod
    def cdf(x): return 0.5 * (1 + math.erf(x / math.sqrt(2)))

# ---------------------------------------------------------------- parameters
BASE = dict(
    # demography (from the game's code, aggregated to three age stages)
    fert=0.265,        # births per married woman-year, 15-49, at no hunger (0.015/day, age factor, 84-day pregnancy+nursing)
    dC=0.027, dA=0.012, dO=0.060,   # base annual death rates of children, adults, old
    kC=1.0, kA=0.3, kO=1.5,          # hunger multipliers k in (1 + k h)
    mat=0.01,          # mother's death per birth
    # B1 marriage valve
    f_home=3.3,        # fields per home with means  [invented: unit of "means"]
    kH=0.75,           # share of homes held by fertile couples [invented]
    # production (B2, pull)
    y=2.35,            # food per field per year at full use, net of seed [invented scale]
    lpw=1.5,           # fields one adult worker can farm at full effort [invented]
    m0=0.15,           # subsistence-and-a-little-more margin [invented]
    m1=1.6,            # extra margin at saturating wanted goods [invented]
    W50=0.5,           # wanted goods (per farm household) at half the pull [invented saturation]
    sig_y=0.15,        # yearly harvest shock (lognormal sd) [invented]
    cv_hh=0.35,        # spread of food per head between households [invented: diagram has only a mean]
    c_clear=0.30,      # share of the land gap cleared a year [invented]
    Lmax=420.0,        # land ceiling, fields (fixed map)
    # B3 kin help + goodwill
    phi0=0.4, phimax=0.85, G50=40.0,  # share of hungry households whose kin can help: with no goodwill, at most [invented: network coverage]   # help effectiveness at no goodwill; goodwill at half the rest [invented]
    gw_half=4.0,       # goodwill half-life, years (code)
    floor=20/48,       # floor: 20 days of need (seed is already netted)
    # B6 feasting
    res=1.0,           # reserve (years of need) kept before feasting [invented]
    f_feast=0.5,       # share of the excess over the reserve feasted [invented]
    g_feast=0.5,       # goodwill per unit feasted [invented: exchange rate food->goodwill]
    # rot (code)
    # sale, R2, R3
    s0=0.25,           # share of the surplus over reserve offered at the fair [invented]
    s1=0.6,            # extra share offered at saturating wanted goods [invented]
    X_fair=15.0,       # food the fair/ship can carry off a year [invented]
    fair_goods=0.3,    # goods per unit food sold at the fair [invented]
    craft=0.35,        # goods a year per craft worker [invented]
    tau_W=3.0,         # years for wanted goods to catch up [invented lag]
    tax=0.35,          # silver tax per farm household, in need-units [invented level]
    kMo=0.5, tau_Mo=8.0,   # money habit: extra sale share at full monetisation; lag [invented]
    # R1 debt and land
    rent=0.25,         # rent: a quarter of the tenanted harvest (design)
    owed=0.04,         # owed labour, share of a tenant's hours (2 days of 48)
    tithe=0.10,        # tithe (history)
    beta=0.6,          # share of the unmet deficit borrowed when lenders exist [invented]
    interest=0.25,     # loans repaid with a quarter more (design)
    rep_frac=0.5,      # share of the surplus over the floor used to repay [invented]
    k_def=0.5,         # share of the overdue debt defaulted a year [invented]
    fv=2.5,            # a field's worth (need-units); passes at half (design: 60 rations of 120)
    pat=0.3,           # share of the unmet deficit covered by a patron [invented]
    k_pat=0.5,         # fields passed per field-worth of patron gift [invented]
    # B5 brakes
    kB=1.0, tau_B=30.0,    # brake target per unit concentration; lag (decades) [invented]
    split=0.6,         # heirs split: share of concentrated land returned a generation [invented]
    # elite
    cE=1.5,            # elite need per head [invented: elite consumption]
    tau_E=8.0,         # years for elite size to follow its income [invented]
    bE=0.030, dE=0.025,
    # town (B4)
    mu=0.25,           # share of the unmarried, landless adults leaving a year [invented]
    mu_pre=0.08,       # same, to village crafts before the town [invented]
    bT=0.028, dT0=0.030,
    crowd=0.02, T50=300.0,   # crowding disease: extra deaths at T50 [invented; disease not designed]
    kT=1.0,            # town hunger multiplier [invented]
    pass_=0.8,         # share of the elite's spare income reaching the town [invented]
    # outside world
    imm=0.5, emig=0.01,
    # phases (year switched on)
    t_fair=30, t_debt=60, t_craft=80, t_ship=100, t_town=110,
)

LOOPS = ['B1', 'B2', 'B3', 'B4', 'B5', 'B6', 'R1', 'R2', 'R3', 'PAT', 'DIS']


def lognorm_parts(mu, cv):
    """Households' food per head x ~ lognormal with mean mu and coefficient of variation cv.
    Returns (E[(1-x)+], E[(x-a)+] with a=1+floor handled by caller, sigma)."""
    s = math.sqrt(math.log(1 + cv * cv))
    return s


def put(mu, s, K):      # E[(K - X)+]
    if mu <= 0: return K
    d1 = (math.log(mu / K) + s * s / 2) / s; d2 = d1 - s
    return K * norm.cdf(-d2) - mu * norm.cdf(-d1)


def call(mu, s, K):     # E[(X - K)+]
    return mu - K + put(mu, s, K)


def below(mu, s, K):    # P(X < K)
    if mu <= 0: return 1.0
    return norm.cdf((math.log(K / mu) + s * s / 2) / s)


def run(p=None, years=200, off=(), seed=1, shocks=None, init=None, record=True, phases=True, t0=0, pulse=None):
    q = dict(BASE); q.update(p or {})
    off = set(off)
    rng = np.random.default_rng(seed)
    z = shocks if shocks is not None else rng.standard_normal(t0 + years + 400)
    # stocks
    st = init or dict(C=14.0, A=22.0, O=4.0, T=0.0, E=0.0, L=30.0, S=20.0, G=0.0, D=0.0,
                      Cn=0.0, B=0.0, W=0.0, Mo=0.0, Ei=0.0)
    st = dict(st)
    s_hh = lognorm_parts(1, q['cv_hh'])
    out = []
    states = []
    for t in range(t0, t0 + years):
        if pulse and t in pulse:
            for k, v in pulse[t].items(): st[k] = st[k] * v
        states.append(dict(st))
        on = lambda k: (not phases) or t >= q[k]
        C, A, O, T, E, L = st['C'], st['A'], st['O'], st['T'], st['E'], st['L']
        Nf = C + A + O
        need = A + O + 0.5 * C                       # farm need
        H = L / q['f_home']                          # homes with means
        hh = max(1.0, need / 3.5)                    # farm households (about 3.5 need-units each)
        Wk = A + 0.5 * O + 0.2 * C                   # workers
        # ---- pull and target output (R2: pull -> made +, pull -> idle -)
        pull = 0.0 if 'R2' in off else st['W'] / (st['W'] + q['W50'])
        rentshare = q['rent'] * st['Cn'] if (on('t_debt') and 'R1' not in off) else 0.0
        tithe = q['tithe'] if on('t_town') else 0.0
        taxdue = q['tax'] * hh if (on('t_ship') and 'R3' not in off) else 0.0
        target = need * (1 + q['m0'] + q['m1'] * pull) / max(0.2, 1 - rentshare - tithe) + taxdue
        if 'B2' in off:   # no diminishing returns: land never binds
            cap_land = 1e9
        else:
            cap_land = L
        owedh = q['owed'] * st['Cn'] if on('t_debt') else 0.0
        cap_lab = q['lpw'] * Wk * (1 + owedh)
        ymult = math.exp(q['sig_y'] * z[t] - q['sig_y'] ** 2 / 2)
        want_fields = target / q['y']
        worked = min(want_fields, cap_land, cap_lab)
        bind = int(np.argmin([want_fields, cap_land, cap_lab]))
        P = q['y'] * worked * ymult
        effort = min(1.0, worked / max(1e-9, q['lpw'] * Wk))
        idle = max(0.0, 1 - effort - owedh)
        # ---- extraction
        rent = rentshare * P; tth = tithe * P
        Av = P - rent - tth + st['S']
        mu = Av / need
        # ---- hunger and kin help (B2, B3)
        D0 = need * put(mu, s_hh, 1.0)
        cap_give = need * call(mu, s_hh, 1 + q['floor'])
        phi = 0.0 if 'B3' in off else q['phi0'] + (q['phimax'] - q['phi0']) * st['G'] / (st['G'] + q['G50'])
        help_ = min(phi * D0, cap_give)
        D1 = D0 - help_
        Sp = Av - (need - D1)                          # left in farm stores after eating own and given help
        reserve = q['floor'] * need
        # ---- debt repayment (aggregate: the surplus households repay while short ones borrow)
        rep = min(st['D'], q['rep_frac'] * max(0.0, Sp - reserve))
        Sp -= rep
        # elite pool (R1 lenders, patronage)
        incE = rent + tth + rep
        eliteate = min(incE, q['cE'] * E)
        elite_h = 1 - eliteate / (q['cE'] * E) if E > 0 else 0
        pool = incE - eliteate
        borrow = q['beta'] * D1 if (on('t_debt') and 'R1' not in off) else 0.0
        borrow = min(borrow, pool); pool -= borrow
        gift = q['pat'] * (D1 - borrow) if (on('t_debt') and 'PAT' not in off and E > 0) else 0.0
        gift = min(gift, pool); pool -= gift
        D2 = D1 - borrow - gift
        h = D2 / need                                  # mean hunger 0..1
        hungry = below(mu, s_hh, 1.0) * (D2 / D0 if D0 > 1e-9 else 0)
        nomarry = below(mu, s_hh, 0.5) * (D2 / D0 if D0 > 1e-9 else 0)
        if 'B2' in off: h = 0.0; hungry = 0.0; nomarry = 0.0
        eaten = need - D2
        # ---- sale (fair, town, ship; R2, R3)
        sale_share = 0.0
        if on('t_fair'):
            sale_share = q['s0'] + q['s1'] * pull + (q['kMo'] * st['Mo'] if 'R3' not in off else 0)
        sale_share = min(0.95, sale_share)
        offer = taxdue + sale_share * max(0.0, Sp - reserve - taxdue)
        offer = min(offer, max(0.0, Sp - reserve))
        townneed = 0.9 * T
        townbuy = max(0.0, townneed - q['pass_'] * pool)
        Xcap = q['X_fair'] * (2 if on('t_ship') else 1) if on('t_fair') else 0.0
        sold = min(offer, townbuy + Xcap)
        to_town = min(sold, townbuy); export = sold - to_town
        arrears = max(0.0, taxdue - sold)
        Sp -= sold
        # ---- feasting (B6)
        excess = max(0.0, Sp - q['res'] * need)
        feast = 0.0 if 'B6' in off else q['f_feast'] * excess
        Sp -= feast
        # ---- rot (code rule)
        N1 = need
        rot = 0.05 * min(Sp, N1) + 0.20 * min(max(Sp - N1, 0), N1) + 0.40 * max(Sp - 2 * N1, 0)
        Snew = max(0.0, Sp - rot)
        passed = min(q['pass_'] * pool, townneed)
        elite_rot = pool - passed
        town_food = to_town + passed
        hT = max(0.0, 1 - town_food / townneed) if T > 0 else 0.0
        # ---- goodwill (B3, B6)
        G = st['G'] * 0.5 ** (1 / q['gw_half']) + help_ + q['g_feast'] * feast + gift
        # ---- debt (R1)
        D = st['D']
        if on('t_debt') and 'R1' not in off:
            D = D - rep + borrow * (1 + q['interest']) + arrears
            overdue = max(0.0, D - 2 * rep)
            dflt = q['k_def'] * overdue
            D -= dflt
            fields_def = dflt / (0.5 * q['fv']) * (1 - (st['B'] if 'B5' not in off else 0))
        else:
            dflt = 0.0; fields_def = 0.0
            D = max(0.0, D - rep)
        fields_pat = q['k_pat'] * gift / q['fv']
        Cn = st['Cn']
        dCn = (fields_def + fields_pat) / max(L, 1) * (1 - Cn)
        heirs = q['split'] * Cn / 25.0 * ((1 + st['B']) if 'B5' not in off else 1)
        Cn = min(0.98, max(0.0, Cn + dCn - heirs))
        Bk = st['B'] + ((q['kB'] * Cn - st['B']) / q['tau_B'] if 'B5' not in off else 0)
        # ---- wanted goods (R2)
        goods = (q['fair_goods'] * export if on('t_fair') else 0) + (q['craft'] * T if on('t_craft') else 0)
        W = st['W'] + (goods / hh - st['W']) / q['tau_W']
        # ---- money (R3)
        Mo = st['Mo']
        if on('t_ship'):
            Mo += (min(1.0, sold / max(P, 1e-9) * 3) - Mo) / q['tau_Mo']
        # ---- people
        couples = min(A / 2, q['kH'] * H) if 'B1' not in off else A / 2
        couples *= (1 - nomarry)
        births = q['fert'] * couples * (1 - h)
        dthC = C * min(1, q['dC'] * (1 + q['kC'] * h))
        dthA = A * min(1, q['dA'] * (1 + q['kA'] * h)) + q['mat'] * births
        dthO = O * min(1, q['dO'] * (1 + q['kO'] * h))
        unmarried = max(0.0, A - 2 * couples)
        if on('t_town') and 'B4' not in off:
            mig = q['mu'] * unmarried * (1 - hT)
        elif on('t_craft') and 'B4' not in off:
            mig = q['mu_pre'] * unmarried * (1 - hT)
        else:
            mig = 0.0
        emig = q['emig'] * unmarried
        # elite mobility: elite size follows its income (moves adults between classes)
        Ei = 0.8 * st['Ei'] + 0.2 * incE
        Estar = Ei / q['cE'] if on('t_debt') else 0.0
        mob = (Estar - E) / q['tau_E']
        mob = max(-E, min(mob, 0.2 * A))
        dis = 0.0 if 'DIS' in off else q['crowd'] * T / q['T50']
        dthT = T * min(1, q['dT0'] + dis + q['kT'] * 0.3 * hT)
        bT = q['bT'] * T * (1 - hT)
        dthE = E * min(1, q['dE'] * (1 + 0.3 * elite_h))
        bE = q['bE'] * E
        new = dict(
            C=C + births - dthC - C / 15.0,
            A=A + C / 15.0 - A / 35.0 - dthA - mig - emig - max(mob, 0) + q['imm'],
            O=O + A / 35.0 - dthO,
            T=T + mig + bT - dthT,
            E=E + mob + bE - dthE,
            L=L + (0 if L >= q['Lmax'] else q['c_clear'] * max(0.0, max(1.1 * want_fields, (A / 2) / q['kH'] * q['f_home']) - L) * (1 - L / q['Lmax'])),
            S=Snew, G=G, D=max(0.0, D), Cn=Cn, B=Bk, W=W, Mo=Mo, Ei=Ei)
        if mob < 0:   # fallen elite become farm adults
            new['A'] += -mob
        for k in new: new[k] = max(0.0, new[k])
        if record:
            out.append(dict(t=t, C=C, A=A, O=O, farm=Nf, T=T, E=E, pop=Nf + T + E, L=L, S=st['S'], G=st['G'], D=st['D'],
                            Cn=st['Cn'], B=st['B'], W=st['W'], Mo=st['Mo'], P=P, need=need, made=P / need,
                            eaten=eaten, own_eaten=need - D1, help=help_, borrow=borrow, gift=gift, rent=rent, tithe=tth,
                            tax=min(taxdue, sold), sold=sold, to_town=to_town, export=export, feast=feast, rot=rot, rep=rep,
                            dS=Snew - st['S'], elite_rot=elite_rot, passed=passed, eliteate=eliteate, town_food=town_food,
                            h=h, hungry=hungry, hT=hT, idle=idle, effort=effort, kept=(eaten + Snew) / need,
                            extracted=(rent + tth + min(taxdue, sold) + rep) / P if P > 0 else 0,
                            births=births, bT=bT, bE=bE, deaths=dthC + dthA + dthO + dthT + dthE, mig=mig, mob=mob, imm=q['imm'], emig=emig,
                            dflt=dflt, pull=pull, bind=bind, Lgap=L / q['Lmax'], gate=1 - couples / max(A / 2, 1e-9), couples=couples, unmarried=unmarried, H=H))
        st = new
    run.states = states
    return (out, st) if record else st


def frame(out):
    import pandas as pd
    return pd.DataFrame(out)


if __name__ == '__main__':
    import pandas as pd
    df = frame(run()[0])
    pd.set_option('display.width', 220)
    print(df.iloc[::10][['t', 'pop', 'farm', 'T', 'E', 'L', 'made', 'kept', 'hungry', 'idle', 'Cn', 'extracted', 'G', 'W', 'Mo', 'sold', 'feast', 'rot']].round(2))
