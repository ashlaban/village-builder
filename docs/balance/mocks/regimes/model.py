"""Round 2: a reduced household-agent model of the whole game arc (200 years, founders to about 1,000).

Throwaway research code (see ../brief.md, ../findings-round1.md). Yearly steps. Food in need-units (an adult's year = 48 rations).
Persons are rows of numpy arrays (age, sex, household, spouse, birth household, father's birth household); households are
rows of arrays (kind, village, store, debt, ...). Land is a fixed set of field slots grouped into village sites ("within a
day's walk"). Mechanisms unlock by stage. Every invented number is in BASE with INV; numbers from the game or round 1 are marked.

What the model keeps that the aggregate model (wholemap/) did not: the spread between households (life cycle, labour per
household, single-person households), kinship (kin bar, kin help), who lends, which field passes, who holds an office.
"""
import math
import numpy as np

YD = 48
AGEF = np.array([0.89, 1, 0.94, 0.86, 0.7, 0.36, 0.05])   # code: births.js

BASE = dict(
    years=200, n_found=3, seed=1,
    # --- demography (code, unless marked)
    amF=18, amM=20, nurse=48, child_mort=1.0, adult_mort=1.0, fert_peak=0.015,
    widow_remarry=45,          # INV widows under this remarry
    # --- land and food
    village_cap=60,            # INV fields within a day's walk of one village site
    n_sites=9,                 # INV village sites on the map (660 fields; ~95% used late)
    claim=3,                   # INV fields a new household clears at once (measured 3.3-3.5 a household later)
    fpw=2.2,                   # INV fields one worker can bring in at the harvest peak (2-worker, 3.4-field farm: ~25% free, measured 18-25%)
    p_clear=0.3,               # INV chance a year a household with spare labour and room clears one more field
    target=1.6,                # INV Chayanov target: households clear toward this much food over need
    found_min=2,               # INV waiting men before a new village site is settled
    p_found=0.3,               # INV chance a year a new site is settled when enough wait
    move_after=2,              # INV years waiting before a man takes land in another village
    soil_wear=0.2,             # measured: seed:yield 3.7 -> 2.9 in 40 years (grain only; food mix dilutes it)
    yf=1.5,                    # INV food per field a year, net of seed (calibrated: food ratio ~1.75)
    g0=1.2,                    # INV gathered food (fish, meat, milk) per worker a year (measured 39-52% of food)
    gcap=45,                   # INV workers a village's commons feed fully
    weather_sd=0.15, bad_p=0.08, bad_mul=0.6, hh_sd=0.25,   # INV (as estates/)
    means=1.5,                 # INV home with means: last harvest / (need + a new adult) >= this
    store_target=1.0, floor=20 / 48, reserve=0.5,           # code floor; INV target and lender reserve
    feast_rate=0.5,            # INV share of the store above target feasted (x generosity 0.5..1.5)
    kin_help=True,
    # --- outside world
    imm=0.25, imm_until=200,   # INV families arriving a year (Poisson); baseline: one every 4 years (founders alone stall, see REPORT)
    # --- stages (year unlocked)
    t_fair=40, t_debt=60, t_craft=80, t_ship=100, t_town=110,
    # --- trade (R2)
    Wd0=0.3, Wd1=3.0, W50=0.5, tau_W=3.0, a_pull=0.4,       # INV wanted goods per farm household; habit saturation; lag; pull on fields
    fair_cap=12.0,             # INV goods the fair brings (paid in food, exported)
    qc=1.6,                    # INV goods a craft worker makes a year (price 1 need-unit)
    craft_free=1.0,            # INV craft homes open while demand exceeds supply by this many goods
    # --- debt and land (R1)
    loans=True, interest=0.25, case_min=1.25, fv=2.5,       # design: a quarter; 60 rations; a field worth 120
    rent=0.30,                 # design: a quarter + 2 days (folded as 0.30)
    let_min=2,                 # INV a household lets fields it cannot work in blocks of this many
    politics=None,             # debtor voice share switching the remedy to labour (None = never)
    lender_sample=12,          # INV
    # --- tithe and office
    offices=True, tithe=0.10, office_per=80,                # history: a tenth; INV one office per 80 people (office_rule 'count')
    office_rule='income',      # 'income': as many offices as last year's tithe keeps at elite standard (a loop); 'count': pop / office_per (a cap)
    elite_std=1.5,             # INV an elite household eats 1.5 x need (wholemap cE)
    unlock='date',             # 'date': stages at t_*; 'pop': at the population thresholds below; 'all': everything from year 0
    u_fair=60, u_debt=120, u_craft=180, u_ship=250, u_town=300,
    # --- the ship and the silver tax (R3)
    tax=0.6, tax_keep=0.5, ship_cap=80.0, tax_road=False,    # INV tax per farm household; share spent in town by office holders
    # --- town (B4)
    mu=0.4,                    # INV chance a year a waiting adult (2+ years) leaves for the town
    mig_sens=4.0,              # INV migration falls as (1 - town hunger) ** mig_sens
    town_d=3.0, town_b=0.85,   # INV town death and fertility multipliers (round 1: town deaths 1.2-3.8x rural)
    town_marry=0.2,            # INV
    pass_=0.6,                 # INV share of the elite's surplus spent in town
    disease=False, crowd=0.6, T50=300.0,                    # INV crowding disease: extra hazard multiplier at T50 town people
    # --- the designer's road (goodwill -> land and prestige)
    patron=False,              # after kin, the richest of the village gives
    gw_land=None,              # goodwill owed to one patron (need-units) that passes a field after 2 years (None = never)
    gw_half=4.0,               # code
    # --- other roads
    escheat='free',            # 'free' or 'kin': land of a household that dies out
    partible=False,
    life_cycle=True,
)

SYS = ['mates', 'homes', 'food', 'labour', 'extract', 'town', 'disease']


def hazard(a, cm=1.0, am=1.0):
    """the code's hazard integrated over the year of age [a, a+1) (so 20% die before 1, as in the game)."""
    return 0.006 * am + 0.0007 * np.exp(0.07 * (a + 0.5)) + 0.381 * cm * (np.exp(-1.265 * a) - np.exp(-1.265 * (a + 1))) / 1.265


def kmul(a):
    return np.where((a < 5) | (a >= 60), 1.5, np.where(a < 15, 0.6, 0.3))


def fert(a, h, q):
    """births a year to a married woman of age a (daily chain approximated by its mean interval)."""
    idx = np.clip(((a - 15) // 5).astype(int), 0, 6)
    c = q['fert_peak'] * AGEF[idx] * (1 - h)
    ok = (a >= 15) & (a < 50) & (c > 1e-6)
    out = np.zeros_like(a, dtype=float)
    out[ok] = YD / (1 / c[ok] + 36 + q['nurse'])
    return np.minimum(out, 0.95)


def gini(x):
    x = np.sort(np.asarray(x, float))
    n = len(x)
    if n == 0 or x.sum() <= 0:
        return 0.0
    cum = np.cumsum(x)
    return float((n + 1 - 2 * (cum / cum[-1]).sum()) / n)


class World:
    CAPP, CAPH = 30000, 8000

    def __init__(self, **kw):
        q = dict(BASE); q.update(kw); self.q = q
        self.r = np.random.default_rng(q['seed'])
        P, H = self.CAPP, self.CAPH
        self.age = np.zeros(P); self.fem = np.zeros(P, bool); self.alive = np.zeros(P, bool)
        self.hh = np.full(P, -1); self.sp = np.full(P, -1); self.bhh = np.full(P, -1); self.lin = np.full(P, -1)
        self.wait = np.zeros(P); self.np_ = 0
        self.kind = np.full(H, -1)        # 0 farm, 1 town/craft, -1 gone
        self.vil = np.full(H, -1); self.store = np.zeros(H); self.debt = np.zeros(H); self.cred = np.full(H, -1)
        self.unpaid = np.zeros(H); self.prest = np.zeros(H); self.gen = np.zeros(H); self.office = np.zeros(H, bool)
        self.prod = np.zeros(H); self.need = np.zeros(H); self.habit = np.zeros(H); self.hung = np.zeros(H)
        self.inc = np.zeros(H); self.owed = np.zeros(H); self.gwrun = np.zeros(H)
        self.kin = [set() for _ in range(H)]; self.nh = 0
        nf = q['n_sites'] * q['village_cap']
        self.fvil = np.repeat(np.arange(q['n_sites']), q['village_cap'])
        self.owner = np.full(nf, -1); self.farmer = np.full(nf, -1); self.acq = np.full(nf, -1)  # 0 clear 1 debt 2 goodwill 3 escheat 4 tax
        self.vopen = np.zeros(q['n_sites'], bool); self.vyear = np.zeros(q['n_sites'])
        self.gw = {}                     # (giver, receiver) -> [value, year]
        self.t = 0; self.remedy = 'land'; self.rec = []
        self.vopen[0] = True
        self.cr_demand = 0.0; self.cr_supply = 0.0; self.hT = 0.0; self.office_pool = 0.0
        self.Mo = 0.0; self.popnow = 10; self.unlocked = {}; self.tithe_last = 0.0
        for i in range(q['n_found']):
            self._family(0, 25 + 3 * i, kids=[[(5, True), (2, False)], [(3, False)], [(1, True)]][i % 3])
        self.track = dict(debt=0, goodwill=0, clear=0, escheat=0, tax=0)

    # ------------------------------------------------------------------ helpers
    def _person(self, age, fem, h, bhh, lin):
        i = self.np_; self.np_ += 1
        self.age[i] = age; self.fem[i] = fem; self.alive[i] = True; self.hh[i] = h; self.bhh[i] = bhh; self.lin[i] = lin
        self.sp[i] = -1; self.wait[i] = 0
        return i

    def _house(self, kind, vil, gen=None):
        h = self.nh; self.nh += 1
        self.kind[h] = kind; self.vil[h] = vil; self.store[h] = 0; self.debt[h] = 0; self.cred[h] = -1
        self.gen[h] = self.r.random() if gen is None else gen; self.kin[h] = set()
        return h

    def _claim(self, h, v, n, mode=0):
        free = np.where((self.fvil == v) & (self.owner < 0))[0][:n]
        self.owner[free] = h; self.farmer[free] = h; self.acq[free] = mode
        return len(free)

    def _family(self, v, age, kids=()):
        h = self._house(0, v)
        m = self._person(age, False, h, -2 - h, -2 - h)          # distinct lineages for founders and immigrants
        w = self._person(age - 2, True, h, -1000 - h, -1000 - h)
        self.sp[m] = w; self.sp[w] = m
        for a, f in kids:
            self._person(a, f, h, h, -2 - h)
        self._claim(h, v, self.q['claim'] + 1)
        self.store[h] = 1.5 * self._needof(h)
        return h

    def _needof(self, h):
        m = self.alive[:self.np_] & (self.hh[:self.np_] == h)
        return float(np.where(self.age[:self.np_][m] >= 12, 1.0, 0.5).sum())

    def on(self, k):
        u = self.q['unlock']
        if u == 'all':
            return True
        if u == 'pop':
            if k not in self.unlocked and self.popnow >= self.q['u' + k[1:]]:
                self.unlocked[k] = self.t
            return k in self.unlocked
        return self.t >= self.q[k]

    def _gwget(self, a, b):
        e = self.gw.get((a, b))
        if not e:
            return 0.0
        return e[0] * 0.5 ** ((self.t - e[1]) / self.q['gw_half'])

    def _gwadd(self, a, b, x):
        self.gw[(a, b)] = [self._gwget(a, b) + x, self.t]

    # ------------------------------------------------------------------ the year
    def step(self):
        q, r = self.q, self.r
        t = self.t
        n = self.np_
        al = self.alive[:n]
        idx = np.where(al)[0]
        age = self.age[idx]; hh = self.hh[idx]
        H = self.nh
        unit = np.where(age >= 12, 1.0, 0.5)
        if not q['life_cycle']:
            pass
        wk = np.where((age >= 15) & (age < 60), 1.0, np.where(((age >= 10) & (age < 15)) | ((age >= 60) & (age < 70)), 0.5, 0.0))
        need = np.bincount(hh, unit, H); work = np.bincount(hh, wk, H); size = np.bincount(hh, None, H)
        self.need[:H] = need
        farm = (self.kind[:H] == 0)
        town = (self.kind[:H] == 1)
        # ---- production
        fm = self.farmer >= 0
        nfarm = np.bincount(self.farmer[fm], None, H)
        cap = q['fpw'] * work
        eff = np.minimum(nfarm, cap)
        vil = np.maximum(self.vil[:H], 0)
        wv = np.bincount(vil[farm], work[farm], q['n_sites'])
        gpw = q['g0'] * np.minimum(1.0, q['gcap'] / np.maximum(wv, 1e-9))
        soil = 1 - q['soil_wear'] * np.minimum(1, (t - self.vyear) / 40.0)
        wv_ = np.exp(r.normal(0, q['weather_sd'], q['n_sites']) - q['weather_sd'] ** 2 / 2)
        if r.random() < q['bad_p']:
            wv_ *= q['bad_mul']
        noise = np.exp(r.normal(0, q['hh_sd'], H) - q['hh_sd'] ** 2 / 2)
        wmul = wv_[vil] * noise
        fieldout = q['yf'] * soil[vil] * eff * wmul
        prod = np.where(farm, fieldout + gpw[vil] * work * wmul, 0.0)
        lablost = np.where(farm, q['yf'] * soil[vil] * (nfarm - eff) * wmul, 0.0)
        pf = np.where(nfarm > 0, fieldout / np.maximum(nfarm, 1), 0)
        self.prod[:H] = prod
        # rent
        ten = fm & (self.owner >= 0) & (self.owner != self.farmer)
        rentpaid = np.zeros(H); rentgot = np.zeros(H)
        if ten.any():
            amt = q['rent'] * pf[self.farmer[ten]]
            np.add.at(rentpaid, self.farmer[ten], amt); np.add.at(rentgot, self.owner[ten], amt)
            rg_acq = np.bincount(self.acq[ten], amt, 5)
        else:
            rg_acq = np.zeros(5)
        tithe = q['tithe'] * prod if (q['offices'] and self.on('t_town')) else np.zeros(H)
        net = prod - rentpaid - tithe
        self.store[:H] += net + rentgot
        offs = np.where(self.office[:H] & (self.kind[:H] >= 0))[0]
        office_inc = np.zeros(H)
        tpool = tithe.sum(); self.tithe_last = tpool
        if len(offs):
            office_inc[offs] += tpool / len(offs)
        else:
            pass  # no office holder: tithe leaves (to a bishop off the map)
        self.store[:H] += office_inc
        # ---- debt service (debtor pays from above need + floor)
        interest_got = np.zeros(H)
        fl = q['floor'] * need
        for d in np.where((self.debt[:H] > 0.01) & (self.kind[:H] >= 0))[0]:
            c = self.cred[d]
            if c < 0 or self.kind[c] < 0:
                self.debt[d] = 0; self.cred[d] = -1; continue
            due = self.debt[d] * (1 + q['interest'])
            avail = max(0.0, self.store[d] - need[d] - fl[d])
            pay = min(due, avail)
            self.store[d] -= pay; self.store[c] += pay
            interest_got[c] += min(pay, self.debt[d] * q['interest'])
            self.debt[d] = due - pay
            self.unpaid[d] = self.unpaid[d] + 1 if pay < 0.5 * due else 0
            if self.debt[d] < 0.05:
                self.debt[d] = 0; self.cred[d] = -1; self.unpaid[d] = 0
            elif self.unpaid[d] >= 2 and self.debt[d] >= q['case_min']:
                self._case(d, c, 1)
        # ---- silver tax (ship stage): farms must sell for silver
        taxpaid = 0.0; tax_town = 0.0; arrears_n = 0
        if self.on('t_ship') and q['tax'] > 0:
            due = q['tax'] * farm
            spare = np.maximum(0, self.store[:H] - need - fl)
            pay = np.minimum(due, spare)
            self.store[:H] -= pay
            taxpaid = pay.sum()
            short = np.where(farm & (pay < due - 1e-9))[0]
            arrears_n = len(short)
            if q['tax_road'] and len(offs):
                for d in short:   # arrears become debt to an office holder (the tax farmer)
                    c = offs[0] if self.cred[d] < 0 else self.cred[d]
                    self.debt[d] += due[d] - pay[d]; self.cred[d] = c
            keep = q['tax_keep'] * taxpaid if len(offs) else 0.0
            if len(offs):
                office_inc[offs] += keep / len(offs)
            tax_town = keep
        # ---- goods market (fair, crafts) and the town's food
        crafts = np.where(town)[0]
        n_craftw = work[crafts].sum() if len(crafts) else 0.0
        supply_cr = q['qc'] * n_craftw if self.on('t_craft') else 0.0
        fair = q['fair_cap'] if self.on('t_fair') else 0.0
        if self.on('t_ship'):
            fair += 0.25 * q['ship_cap']
        want = np.where(farm, q['Wd0'] + q['Wd1'] * self.habit[:H], 0) if self.on('t_fair') else np.zeros(H)
        spare = np.maximum(0, self.store[:H] - need * (1 + q['reserve']) - fl)
        buy = np.minimum(want, spare)
        D = buy.sum(); S = supply_cr + fair
        sold = min(D, S)
        got = buy * (sold / D) if D > 0 else np.zeros(H)
        self.store[:H] -= got
        to_craft = min(sold, supply_cr); exported = sold - to_craft
        self.cr_demand, self.cr_supply = D - min(D, fair), supply_cr   # local demand left after the fair, local supply
        self.habit[:H] += (got / (got + q['W50'] + 1e-9) * (got > 0) - self.habit[:H]) / q['tau_W']
        # ---- elite spending in town (surplus over a target) and the town's food
        elite_mask = (rentgot + office_inc + interest_got) >= 0.75 * np.maximum(need, 1)
        el = np.where(elite_mask & (self.kind[:H] >= 0))[0]
        spend = 0.0
        for e in el:
            s = max(0.0, self.store[e] - 1.5 * need[e] * (1 + q['store_target']) - fl[e]) * q['pass_']
            self.store[e] -= s; spend += s
        townfood = to_craft + tax_town + spend
        townneed = need[town].sum()
        hT = max(0.0, 1 - townfood / townneed) if townneed > 0 else 0.0
        self.hT = hT
        self.store[:H][town] = 0
        # ---- eating, kin help, patrons, loans
        flows = dict(kin=0.0, patron=0.0, lent=0.0)
        gap = np.where(farm, np.maximum(0, need - self.store[:H]), 0)
        short = list(np.where(gap > 1e-6)[0]); r.shuffle(short)
        for h in short:
            g = gap[h]
            if q['kin_help']:
                for k in sorted(self.kin[h], key=lambda k: -self.store[k]):
                    if g <= 0: break
                    if self.kind[k] < 0: continue
                    sp_ = self.store[k] - need[k] - fl[k] - q['reserve'] * need[k]
                    owe = self._gwget(h, k)
                    willing = owe + (0.5 + self.gen[k]) * max(0, sp_)
                    x = min(g, max(0, sp_), willing)
                    if x <= 0: continue
                    self.store[k] -= x; self.store[h] += x; g -= x; flows['kin'] += x
                    self._gwadd(k, h, x)
            if q['patron'] and g > 0:
                vs = np.where((self.vil[:H] == self.vil[h]) & farm)[0]
                vs = vs[vs != h]
                if len(vs):
                    k = vs[np.argmax(self.store[vs] - 2 * need[vs])]
                    sp_ = self.store[k] - need[k] - fl[k] - q['reserve'] * need[k]
                    x = min(g, max(0, sp_) * (0.5 + self.gen[k]))
                    if x > 0:
                        self.store[k] -= x; self.store[h] += x; g -= x; flows['patron'] += x
                        self._gwadd(k, h, x); self.prest[k] += x
            if q['loans'] and self.on('t_debt') and g > 0:
                own = (self.owner == h).sum()
                room = own * q['fv'] - self.debt[h]
                if room > 0:
                    if self.cred[h] >= 0 and self.kind[self.cred[h]] >= 0:
                        cands = np.array([self.cred[h]])
                    else:
                        pool = np.where(farm | elite_mask[:H])[0]
                        pool = pool[(pool != h) & (self.kind[pool] >= 0)]
                        cands = r.choice(pool, min(q['lender_sample'], len(pool)), replace=False) if len(pool) else np.array([], int)
                    if len(cands):
                        sp_ = self.store[cands] - need[cands] - fl[cands] - q['reserve'] * need[cands]
                        k = cands[np.argmax(sp_)]; s = sp_.max()
                        x = min(g, room, max(0, s))
                        if x > 0:
                            self.store[k] -= x; self.store[h] += x; g -= x; flows['lent'] += x
                            self.debt[h] += x; self.cred[h] = k
        eat = np.minimum(need, np.maximum(self.store[:H], 0))
        h_ = np.where(need > 0, 1 - eat / np.maximum(need, 1e-9), 0)
        h_ = np.where(town, hT, h_)
        self.store[:H] -= np.where(farm, eat, 0)
        self.hung[:H] = h_
        # ---- feasting and rot
        tgt = need * q['store_target'] + fl
        above = np.maximum(0, self.store[:H] - tgt)
        feast = np.where(farm, np.minimum(above, q['feast_rate'] * (0.5 + self.gen[:H]) * above), 0)
        self.store[:H] -= feast
        self.prest[:H] = self.prest[:H] * 0.8 + feast
        s = np.maximum(self.store[:H], 0)
        rot = 0.05 * np.minimum(s, need) + 0.2 * np.clip(s - need, 0, need) + 0.4 * np.maximum(s - 2 * need, 0)
        self.store[:H] -= rot
        # goodwill road: one-sided goodwill passes a field
        gw_fields = 0
        if q['gw_land'] is not None and self.on('t_debt'):
            for (a, b), e in list(self.gw.items()):
                v = self._gwget(a, b)
                if v < 0.05:
                    del self.gw[(a, b)]; continue
                if v >= q['gw_land'] and self.kind[a] >= 0 and self.kind[b] == 0:
                    own = np.where((self.owner == b))[0]
                    if len(own):
                        self.owner[own[0]] = a; self.acq[own[0]] = 2; self.track['goodwill'] += 1; gw_fields += 1
                        if self.farmer[own[0]] < 0: self.farmer[own[0]] = b
                        self.gw[(a, b)] = [v - q['fv'], t]
        # ---- record (before demography; uses this year's flows)
        rec = self._record(dict(need=need, work=work, size=size, farm=farm, town=town, prod=prod, h=h_, rentpaid=rentpaid, rentgot=rentgot,
                                tithe=tithe, office_inc=office_inc, interest_got=interest_got, taxpaid=taxpaid, sold=sold, got=got,
                                feast=feast, rot=rot, lablost=lablost, nfarm=nfarm, cap=cap, eff=eff, townfood=townfood, townneed=townneed,
                                hT=hT, D=D, S=S, el=el, rg_acq=rg_acq, flows=flows, idx=idx, age=age, hh=hh, arrears=arrears_n,
                                exported=exported, gw_fields=gw_fields, spend=spend))
        # ---- demography
        self._demography(idx, age, hh, h_, need, prod, rec)
        self._marriage(need, prod, cap, nfarm, rec)
        self._land(need, work, nfarm)
        self._offices()
        self._politics()
        self.t += 1
        return rec

    def _case(self, d, c, mode):
        q = self.q
        if self.remedy == 'labour':
            self.owed[d] += self.debt[d]; self.debt[d] = 0; self.cred[d] = -1; self.unpaid[d] = 0
            return
        own = np.where(self.owner == d)[0]
        if len(own) == 0:
            self.debt[d] = 0; self.cred[d] = -1; self.unpaid[d] = 0; return
        f = own[0]
        self.owner[f] = c; self.acq[f] = mode
        if self.farmer[f] < 0: self.farmer[f] = d
        self.track['debt' if mode == 1 else 'tax'] += 1
        self.debt[d] = max(0.0, self.debt[d] - q['fv']); self.unpaid[d] = 0
        if self.debt[d] < 0.05: self.cred[d] = -1

    def _politics(self):
        q = self.q
        if q['politics'] is None or not self.on('t_debt'):
            return
        H = self.nh
        farm = self.kind[:H] == 0
        nd = (farm & (self.debt[:H] > 0)).sum()
        share = nd / max(1, farm.sum())
        if self.remedy == 'land' and share >= q['politics']:
            self.remedy = 'labour'
        elif self.remedy == 'labour' and share < q['politics'] - 0.1:
            self.remedy = 'land'

    # ------------------------------------------------------------------ demography
    def _demography(self, idx, age, hh, h_, need, prod, rec):
        q, r = self.q, self.r
        H = self.nh
        hp = h_[hh]
        townp = self.kind[hh] == 1
        mult = np.ones(len(idx))
        dis_mult = 1.0
        if q['disease']:
            T = rec['town']
            dis_mult = 1 + q['crowd'] * T / q['T50']
        mult = np.where(townp, q['town_d'] * dis_mult, 1.0)
        hz = hazard(age, q['child_mort'], q['adult_mort']) * (1 + kmul(age) * hp) * mult
        die = r.random(len(idx)) < 1 - np.exp(-hz)
        # births
        f = self.fem[idx]
        spo = self.sp[idx]
        withsp = (spo >= 0)
        withsp[withsp] = self.alive[spo[withsp]] & (self.hh[spo[withsp]] == hh[withsp])
        mothers = f & withsp & (age >= 15) & (age < 50) & ~die
        pb = np.zeros(len(idx))
        pb[mothers] = fert(age[mothers], hp[mothers], q) * np.where(townp[mothers], q['town_b'], 1.0)
        born = r.random(len(idx)) < pb
        # childbed
        cb = born & (r.random(len(idx)) < 0.01)
        die |= cb
        dead = idx[die]
        self.alive[dead] = False
        rec['deaths'] = len(dead); rec['births'] = int(born.sum())
        self.popnow = len(idx) - len(dead) + rec['births']
        for m in idx[born]:
            fa = self.sp[m]
            self._person(0, r.random() < 100 / 205, self.hh[m], self.hh[m], self.bhh[fa] if fa >= 0 else self.bhh[m])
        # widowhood
        sp = self.sp[:self.np_]
        w = (sp >= 0)
        w[w] &= ~self.alive[sp[w]]
        self.sp[:self.np_][w] = -1
        self.age[idx] += 1
        # households that die out; orphans go to kin
        n = self.np_
        al = self.alive[:n]
        adult_ct = np.bincount(self.hh[:n][al & (self.age[:n] >= 15)], None, H)
        any_ct = np.bincount(self.hh[:n][al], None, H)
        for h in np.where((self.kind[:H] >= 0) & (adult_ct == 0))[0]:
            kids = np.where(al & (self.hh[:n] == h))[0]
            if len(kids):
                ks = [k for k in self.kin[h] if self.kind[k] >= 0 and adult_ct[k] > 0]
                if not ks:
                    vs = np.where((self.kind[:H] >= 0) & (adult_ct > 0))[0]
                    ks = list(vs[:1])
                if ks:
                    self.hh[kids] = ks[0]
                else:
                    self.alive[kids] = False
            self._dissolve(h)

    def _dissolve(self, h):
        q = self.q
        self.kind[h] = -1; self.office[h] = False
        own = np.where(self.owner == h)[0]
        heirs = [k for k in self.kin[h] if self.kind[k] == 0]
        for f in own:
            if self.farmer[f] >= 0 and self.farmer[f] != h:
                self.owner[f] = self.farmer[f]; self.acq[f] = 3         # the tenant keeps it
            elif q['escheat'] == 'kin' and heirs:
                k = max(heirs, key=lambda k: (self.owner == k).sum())
                self.owner[f] = k; self.farmer[f] = k; self.acq[f] = 3; self.track['escheat'] += 1
            else:
                self.owner[f] = -1; self.farmer[f] = -1; self.acq[f] = -1
        tf = np.where(self.farmer == h)[0]
        self.farmer[tf] = -1
        self.debt[h] = 0
        for d in np.where(self.cred[:self.nh] == h)[0]:
            self.debt[d] = 0; self.cred[d] = -1

    # ------------------------------------------------------------------ marriage and homes
    def _barred(self, m, w):
        a = (self.bhh[m], self.lin[m]); b = (self.bhh[w], self.lin[w])
        return a[0] == b[0] or a[1] == b[1] or a[0] == b[1] or a[1] == b[0]

    def _marriage(self, need, prod, cap, nfarm, rec):
        q, r = self.q, self.r
        n = self.np_; H = self.nh
        al = self.alive[:n]
        age = self.age[:n]
        hung = self.hung
        kind = self.kind
        single = al & (self.sp[:n] < 0)
        hk = self.hh[:n]
        ok_h = hung[hk] < 0.5
        men = np.where(single & ~self.fem[:n] & (age >= q['amM']) & (age < 55) & ok_h)[0]
        women = np.where(single & self.fem[:n] & (age >= q['amF']) & (age < q['widow_remarry']) & ok_h)[0]
        men = men[np.argsort(-age[men])]
        wfarm = [w for w in women if kind[hk[w]] == 0]
        wtown = [w for w in women if kind[hk[w]] == 1]
        r.shuffle(wfarm); r.shuffle(wtown)
        married_men = np.bincount(hk[al & ~self.fem[:n] & (self.sp[:n] >= 0)], None, H)
        nhome = nmate = 0
        cause = dict(homes=0, mates=0)
        free_by_v = np.bincount(self.fvil[self.owner < 0], None, q['n_sites']) * self.vopen
        letting = None
        for m in men:
            h = hk[m]
            if kind[h] == 1:
                # town marriage
                if wtown and r.random() < q['town_marry']:
                    for j, w in enumerate(wtown):
                        if not self._barred(m, w):
                            wtown.pop(j); self._wed(m, w, h, new=True, kind_=1, vil=self.vil[h]); break
                continue
            if kind[h] != 0:
                continue
            # find a home
            home = None
            if self.bhh[m] == h and married_men[h] <= 1 and prod[h] >= q['means'] * (need[h] + 1.0) * (1 - q['floor'] * 0):
                # heir (eldest first) if no brother has married in
                home = ('heir', h)
            if home is None:
                v = self.vil[h]
                if free_by_v[v] >= q['claim']:
                    home = ('land', v)
                elif self.wait[m] >= q['move_after']:
                    vs = np.where(free_by_v >= q['claim'])[0]
                    if len(vs):
                        home = ('land', int(vs[0]))
            if home is None and self.on('t_debt'):
                if letting is None:
                    H0 = len(cap)
                    own_self = np.bincount(self.owner[(self.owner >= 0) & (self.owner == self.farmer)], None, self.nh)[:H0]
                    letting = np.where((kind[:H0] == 0) & (own_self - cap >= q['let_min']))[0].tolist()
                if letting:
                    home = ('tenant', letting.pop(0))
            if home is None and self.on('t_craft') and self.cr_demand - self.cr_supply > q['craft_free']:
                home = ('craft', self.vil[h])
                self.cr_supply += q['qc'] * 2
            if home is None:
                self.wait[m] += 1; nhome += 1
                continue
            # find a wife
            wife = None
            for j, w in enumerate(wfarm):
                if not self._barred(m, w):
                    wife = wfarm.pop(j); break
            if wife is None:
                nmate += 1; self.wait[m] += 1
                continue
            kindh, x = home
            if kindh == 'heir':
                self._wed(m, wife, h, new=False)
                married_men[h] += 1
            elif kindh == 'land':
                nh = self._wed(m, wife, h, new=True, kind_=0, vil=x)
                got = self._claim(nh, x, q['claim']); free_by_v[x] -= got
                self.track['clear'] += got
            elif kindh == 'tenant':
                nh = self._wed(m, wife, h, new=True, kind_=0, vil=self.vil[x])
                fs = np.where((self.owner == x) & (self.farmer == x))[0][: q['let_min']]
                self.farmer[fs] = nh
            elif kindh == 'craft':
                self._wed(m, wife, h, new=True, kind_=1, vil=x)
        rec['wait_home'] = nhome; rec['wait_mate'] = nmate
        # unmarried women of marrying age (for the regime account)
        rec['w_single'] = len(wfarm)
        # account: births lost by women of marrying age left unmarried this year, for want of a home or of a partner
        if wfarm:
            wf = np.array(wfarm)
            lb = fert(self.age[wf], np.zeros(len(wf)), q).sum()
            pop = max(1, int(al.sum()))
            tot = nhome + nmate
            rec['L_homes'] = 100 * lb * (nhome / tot if tot else 0) / pop
            rec['L_mates'] = 100 * lb * (nmate / tot if tot else 1) / pop
        else:
            rec['L_homes'] = rec['L_mates'] = 0.0
        # town migration: waiting adults
        if self.on('t_town'):
            T_h = None
            cand = np.where(al & (self.sp[:n] < 0) & (age >= 18) & (age < 40) & (kind[hk] == 0) & (self.bhh[:n] == hk))[0]
            cand = cand[(self.wait[cand] >= 2) | (self.fem[cand] & (age[cand] >= q['amF'] + 3))]
            go = cand[r.random(len(cand)) < q['mu'] * (1 - self.hT) ** q['mig_sens']]
            for p in go:
                if T_h is None or r.random() < 0.3:
                    T_h = self._house(1, -1)
                self.hh[p] = T_h
            rec['mig'] = len(go)
        else:
            rec['mig'] = 0
        # immigration
        if t_ok(self) and q['imm'] > 0:
            for _ in range(r.poisson(q['imm'])):
                vs = np.where(free_by_v >= q['claim'] + 1)[0]
                if len(vs):
                    self._family(int(vs[0]), int(r.integers(20, 30)), kids=[(int(r.integers(0, 6)), bool(r.random() < .5))])
                    free_by_v[vs[0]] -= q['claim'] + 1

    def _wed(self, m, w, h, new, kind_=0, vil=None):
        self.sp[m] = w; self.sp[w] = m; self.wait[m] = 0
        if not new:
            self.kin[h].add(self.hh[w]); self.kin[self.hh[w]].add(h)
            self.hh[w] = h
            return h
        nh = self._house(kind_, vil if vil is not None else self.vil[h], gen=min(1, max(0, self.gen[h] + self.r.normal(0, 0.2))))
        for x in (self.hh[m], self.hh[w]):
            if self.kind[x] >= 0:
                self.kin[nh].add(x); self.kin[x].add(nh)
                if kind_ == 0:
                    dow = min(0.25 * self.need[nh] + 0.5, max(0.0, self.store[x] - self.need[x])) if x >= 0 else 0
                    self.store[x] -= dow; self.store[nh] += dow
        self.hh[m] = nh; self.hh[w] = nh
        if kind_ == 0:
            self.store[nh] += 0.5
        return nh

    # ------------------------------------------------------------------ land: clearing and new villages
    def _land(self, need, work, nfarm):
        q, r = self.q, self.r
        H = len(need)
        free_by_v = np.bincount(self.fvil[self.owner < 0], None, q['n_sites']) * self.vopen
        soil = 1 - q['soil_wear'] * np.minimum(1, (self.t - self.vyear) / 40.0)
        for h in np.where(self.kind[:H] == 0)[0]:
            v = self.vil[h]
            if free_by_v[v] <= 0:
                continue
            tgt = (need[h] * (q['target'] + q['a_pull'] * self.habit[h]) - q['g0'] * work[h]) / (q['yf'] * soil[v])
            if nfarm[h] < min(tgt, q['fpw'] * work[h]) and r.random() < q['p_clear']:
                if self._claim(h, v, 1):
                    free_by_v[v] -= 1; self.track['clear'] += 1
        # a new village when men wait for land and no open village has room
        if self.vopen.sum() < q['n_sites'] and (free_by_v >= q['claim']).sum() == 0:
            if self._waiting_men() >= q['found_min'] and r.random() < q['p_found']:
                v = int(np.argmin(self.vopen))
                self.vopen[v] = True; self.vyear[v] = self.t

    def _waiting_men(self):
        n = self.np_
        return int((self.alive[:n] & ~self.fem[:n] & (self.sp[:n] < 0) & (self.wait[:n] >= 1)).sum())

    def _offices(self):
        q = self.q
        if not (q['offices'] and self.on('t_town')):
            return
        H = self.nh
        n = self.np_
        pop = self.alive[:n].sum()
        if q['office_rule'] == 'income':
            hs = 4.5 * q['elite_std']
            k = int(self.tithe_last / hs) if self.tithe_last > 0 else 1
        else:
            k = int(round(pop / q['office_per']))
        cur = np.where(self.office[:H] & (self.kind[:H] >= 0))[0]
        self.office[:H] &= self.kind[:H] >= 0
        if len(cur) < k:
            # filled by standing: land owned and prestige (the designer's prestige road)
            own = np.bincount(self.owner[self.owner >= 0], None, H)
            score = own + 0.5 * self.prest[:H]
            score[(self.kind[:H] != 0) | self.office[:H]] = -1
            for h in np.argsort(-score)[: k - len(cur)]:
                if score[h] >= 0:
                    self.office[h] = True
        elif len(cur) > k:
            self.office[cur[k:]] = False

    # ------------------------------------------------------------------ record
    def _record(self, d):
        q = self.q
        H = self.nh
        n = self.np_
        idx, age, hh = d['idx'], d['age'], d['hh']
        farm, town = d['farm'], d['town']
        need = d['need']
        el = d['el']
        elite = np.zeros(H, bool); elite[el] = True
        pop = len(idx)
        nT = int(town[hh].sum()); nE = int(elite[hh].sum()); nF = pop - nT - nE
        fh = np.where(farm & ~elite & (need > 0))[0]
        ratio = d['prod'][fh] / need[fh]
        own = np.bincount(self.owner[self.owner >= 0], None, H)
        land_holders = np.where((farm | elite) & (self.kind[:H] >= 0))[0]
        fm = self.farmer >= 0
        ten = fm & (self.owner != self.farmer)
        totP = d['prod'].sum()
        hmean_pop = float((d['h'][hh] > 0.2).mean()) if pop else 0
        # ---- regime account: growth points lost, by limit
        hp = d['h'][hh]
        f = self.fem[idx]
        spo = self.sp[idx]
        married = f & (spo >= 0)
        base_f = fert(age, np.zeros(len(idx)), q)
        lost = dict.fromkeys(SYS, 0.0)
        # unmarried women of marrying age: lost births to homes or mates
        uw = f & ~married & (age >= q['amF']) & (age < 45) & ~town[hh]
        lb = base_f[uw].sum()
        wh = getattr(self, '_last_wait', (0, 0))
        tot_w = wh[0] + wh[1]
        if tot_w > 0:
            lost['homes'] += lb * wh[0] / tot_w; lost['mates'] += lb * wh[1] / tot_w
        else:
            lost['mates'] += lb
        # hunger: births and deaths lost; split by cause in hungry farm households
        hz = hazard(age, q['child_mort'], q['adult_mort'])
        hl = (married * base_f * hp) + hz * kmul(age) * hp     # per person
        per_h = np.bincount(hh, hl, H)
        gapv = d['h'] * need
        lab = np.minimum(d['lablost'], gapv); ext = np.minimum(d['rentpaid'] + d['tithe'], np.maximum(0, gapv - lab))
        sh_lab = np.where(gapv > 1e-9, lab / np.maximum(gapv, 1e-9), 0); sh_ext = np.where(gapv > 1e-9, ext / np.maximum(gapv, 1e-9), 0)
        fl_ = farm & ~town
        lost['labour'] += (per_h * sh_lab)[fl_].sum(); lost['extract'] += (per_h * sh_ext)[fl_].sum()
        lost['food'] += (per_h * (1 - sh_lab - sh_ext))[fl_].sum()
        # town: births and deaths relative to the countryside, plus its own hunger
        tp = town[hh]
        if tp.any():
            excess_d = (hz * (q['town_d'] - 1))[tp].sum()
            lost_b = (married * base_f * (1 - q['town_b']))[tp].sum()
            lost['town'] += excess_d + lost_b + per_h[town].sum()
            if q['disease']:
                lost['disease'] += (hz * q['town_d'] * q['crowd'] * nT / q['T50'])[tp].sum()
        for k in lost:
            lost[k] = 100 * lost[k] / max(pop, 1)
        # the town's two limits
        bT = (married * base_f * q['town_b'])[tp].sum() / max(nT, 1)
        dT = (hz * q['town_d'] * (1 + (q['crowd'] * nT / q['T50'] if q['disease'] else 0)))[tp].sum() / max(nT, 1)
        mig = getattr(self, '_last_mig', 0)
        M_lim = min(5000.0, mig / (dT - bT)) if (nT and dT > bT) else 5000.0
        S_lim = d['townfood'] / max(d['townneed'] / max(nT, 1), 0.7) if nT else d['townfood'] / 0.85
        rec = dict(t=self.t, pop=pop, farm=nF, town=nT, elite=nE, elite_hh=len(el), hh=int((self.kind[:H] >= 0).sum()),
                   farm_hh=int(farm.sum()), ratio_mean=float(ratio.mean()) if len(ratio) else 0, ratio_med=float(np.median(ratio)) if len(ratio) else 0,
                   under1=float((ratio < 1).mean()) if len(ratio) else 0, hungry=hmean_pop,
                   hungry_hh=float((d['h'][fh] > 0.2).mean()) if len(fh) else 0,
                   extracted=float((d['rentpaid'].sum() + d['tithe'].sum() + d['taxpaid'] + d['interest_got'].sum()) / max(totP, 1e-9)),
                   sold=float((d['sold'] + d['taxpaid']) / max(totP, 1e-9)), feast=float(d['feast'].sum() / max(totP, 1e-9)),
                   rot=float(d['rot'].sum() / max(totP, 1e-9)),
                   gini=gini(own[land_holders]) if len(land_holders) else 0, tenancy=float(ten.sum() / max(fm.sum(), 1)),
                   fields=int(fm.sum()), villages=int(self.vopen.sum()), free=int(((self.owner < 0) & self.vopen[self.fvil]).sum()),
                   lab_lost=float(d['lablost'].sum() / max(totP, 1e-9)), labour_bound=float((d['nfarm'][fh] > d['cap'][fh] + 1e-9).mean()) if len(fh) else 0,
                   idle=float(1 - d['eff'][farm].sum() / max(d['cap'][farm].sum(), 1e-9)),
                   hT=d['hT'], townfood=d['townfood'], M_lim=M_lim, S_lim=S_lim, D=d['D'], S=d['S'], dT=dT, bT=bT,
                   offices=int(self.office[:H].sum()), debtors=int(((self.debt[:H] > 0) & farm).sum()),
                   rent_by=d['rg_acq'].tolist(), office_inc=float(d['office_inc'].sum()), rent_tot=float(d['rentpaid'].sum()),
                   interest=float(d['interest_got'].sum()), kin=d['flows']['kin'], patron=d['flows']['patron'], lent=d['flows']['lent'],
                   gw=float(sum(self._gwget(a, b) for (a, b) in list(self.gw)[:5000])) if self.gw else 0.0, gw_fields=d['gw_fields'],
                   arrears=d['arrears'], exported=d['exported'], spend=d['spend'], estates=int((own >= 12).sum()),
                   elite_off=int(self.office[el].sum()), ten_hungry=float((d['h'][np.unique(self.farmer[ten])] > 0.05).mean()) if ten.any() else 0.0,
                   mean_hh_size=float(pop / max(1, (self.kind[:H] >= 0).sum())), remedy=self.remedy, **{'L_' + k: v for k, v in lost.items()})
        rec['track'] = dict(self.track)
        return rec


def t_ok(w):
    return w.t < w.q['imm_until']


def run(**kw):
    w = World(**kw)
    out = []
    for _ in range(w.q['years']):
        rec = w.step()
        w._last_wait = (rec['wait_home'], rec['wait_mate'])
        w._last_mig = rec['mig']
        out.append(rec)
        if rec['pop'] == 0:
            break
    return out, w


def frame(out):
    import pandas as pd
    return pd.DataFrame([{k: v for k, v in r.items() if k not in ('rent_by', 'track')} for r in out])


if __name__ == '__main__':
    import sys, time, pandas as pd
    t0 = time.time()
    out, w = run(**dict(a.split('=') and (a.split('=')[0], eval(a.split('=')[1])) for a in sys.argv[1:]))
    df = frame(out)
    pd.set_option('display.width', 250); pd.set_option('display.max_columns', 40)
    print(df.iloc[::10][['t', 'pop', 'farm', 'town', 'elite', 'elite_hh', 'farm_hh', 'villages', 'free', 'ratio_mean', 'ratio_med', 'under1',
                         'hungry', 'extracted', 'rot', 'gini', 'tenancy', 'L_homes', 'L_mates', 'L_food', 'L_town', 'hT', 'S_lim', 'M_lim', 'D', 'S']].round(2))
    print('track', w.track, 'time', round(time.time() - t0, 1))
