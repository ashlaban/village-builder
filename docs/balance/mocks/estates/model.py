"""Household-level mock of the surplus split and the road from hunger to a landed elite.

Throwaway research code for the balance-map experiments (see ../brief.md). Yearly steps.
Units: rations (1 adult-day of food). A year is 48 game days, so an adult needs 48 rations a year.

Numbers from the brief: death hazard and hunger multipliers, conception age factors, rations (adult 1, child 0.5),
floor (seed + 20 days of need), rot (5% / 20% / 40% bands), goodwill halving in 4 years, rent a quarter,
loans a quarter, default after two unpaid harvests, a field passes when debt >= 60 (half a field's worth, so a
field is worth 120), landed rule (rents and stores >= 1.5 x need three year ends running), a hired day costs 3.

Inventions (all in P below, each marked INV): see REPORT.md, section "Inventions".
"""
import math
import numpy as np

YEAR_DAYS = 48
AGE_FACTOR = [0.89, 1, 0.94, 0.86, 0.7, 0.36, 0.05]

P = dict(
    n_households=200,
    years=150,
    R=1.67,                 # target food produced (net of seed) / need for a reference household -> sets yield per field
    ref_units=4.3,          # INV mean consumption units a household at the demographic steady state (measured)
    fields_mean=6,          # INV fields per household at start (uniform 3..9)
    field_value=120,        # brief: half a field's worth is 60 rations
    weather_sd=0.20,        # INV village-wide harvest noise (lognormal sd)
    disaster_p=0.08,        # INV chance of a bad year
    disaster_mul=0.55,      # INV harvest multiplier in a bad year
    hh_sd=0.15,             # INV household harvest noise
    days_per_field=8,       # INV worker-days a field needs a year
    days_per_worker=40,     # INV usable working days of an adult a year (of 48)
    store_target=1.0,       # INV peasants keep 1 year of need (plus floor) before feasting/selling ("subsistence and a little more")
    floor_days=20,          # brief: floor = seed + 20 days of need (seed is already netted out)
    reserve=0.5,            # INV a giver/lender keeps floor + this x own need before giving or lending
    # goodwill economy
    feasting=True,
    feast_rate=0.5,         # INV share of store above target feasted a year (times generosity 0.5..1.5)
    feast_credit=0.5,       # INV goodwill a guest owes per ration feasted
    kin_help=True,
    kin_links=4,            # INV kin households per household
    goodwill_half=4.0,      # brief: goodwill halves in 4 years
    # loans and estates
    loans=False,
    interest=0.25,          # brief: a quarter (INV: charged each harvest on the unpaid balance)
    default_after=2,        # brief
    case_min_debt=60,       # brief
    rent=0.25,              # brief: tenant pays a quarter of the harvest
    rent_days=2,            # brief: plus 2 days' labour (per field, INV)
    hire_cost=3,            # brief
    hire_share=0.5,         # INV share of a household's slack days it sells as hired labour
    # patronage
    patronage=False,
    collateral=False,       # INV option: lenders lend only against unencumbered fields (field value less debts owed)
    lender_sample=12,       # INV a short household asks this many random households with spare, the richest first
    patron_min_gen=0.5,     # INV only households with generosity >= this act as patrons
    # extraction outside rent
    tithe=0.0,
    sale=0.0,               # share of the store above target sold out of the village a year
    # brakes
    partible=0.0,           # share of the land split among non-heir adult children at a holder's death
    min_split=4,            # INV a claimant needs at least this many fields to set up a household (else the share stays with the heir)
    leave_p=0.0,            # chance a hungry (h>0.2) tenant household leaves each year
    relet_p=0.3,            # INV chance a year a vacant field is let to a newcomer family (in blocks)
    politics=None,          # debtor voice share that switches the remedy from land to labour (None = never)
    politics_margin=0.1,    # INV hysteresis: switch back when below threshold - margin
    landed_voice=2.0,       # INV voice weight of a landed household (clients vote with their patron)
    lifecycle=True,         # False: every household fixed at the mean: 4.3 consumption units, 3.15 workers, nobody dies
    gen_inherit=0.2,        # INV generosity inherited with this noise
)


class Person:
    __slots__ = ("age", "female", "wife", "heir")

    def __init__(self, age, female, wife=False, heir=False):
        self.age, self.female, self.wife, self.heir = age, female, wife, heir


class HH:
    _next = 0

    def __init__(self, rng, people, gen):
        self.id = HH._next
        HH._next += 1
        self.people = people
        self.store = 0.0
        self.debt = {}         # creditor id -> amount
        self.unpaid = {}       # creditor id -> unpaid harvests in a row
        self.gw = {}           # other id -> goodwill the other owes me (rations)
        self.owed_days = {}    # patron id -> rations still to work off
        self.kin = set()
        self.gen = gen         # generosity 0..1
        self.claimants = []    # ages of adult children who left
        self.landed_run = 0
        self.landed_run_r = 0
        self.hunger = 0.0
        self.alive = True
        self.prestige = 0.0
        self.born = 0
        self.landed_ever = False
        self.rent_in = 0.0
        self.heir_wife = None

    def units(self, P):
        if not P["lifecycle"]:
            return P["ref_units"]
        return sum(1.0 if p.age >= 12 else 0.5 for p in self.people)

    def workers(self, P):
        if not P["lifecycle"]:
            return 3.15  # mean workers a household with the life cycle on (measured)
        w = 0.0
        for p in self.people:
            if 15 <= p.age < 60:
                w += 1
            elif 10 <= p.age < 15 or 60 <= p.age < 70:
                w += 0.5
        return w


def hazard(age, h):
    base = 0.006 + 0.0007 * math.exp(0.07 * age) + 0.381 * math.exp(-1.265 * age)
    k = 1.5 if (age < 5 or age >= 60) else (0.6 if age < 15 else 0.3)
    return min(1.0, base * (1 + k * h))


def rot(store, need):
    a = min(store, need)
    b = min(max(store - need, 0), need)
    c = max(store - 2 * need, 0)
    return 0.05 * a + 0.20 * b + 0.40 * c


def gini(x):
    x = np.sort(np.asarray(x, float))
    n = len(x)
    if n == 0 or x.sum() == 0:
        return 0.0
    cum = np.cumsum(x)
    return (n + 1 - 2 * (cum / cum[-1]).sum()) / n


class World:
    def __init__(self, P, seed):
        self.P = P
        self.rng = np.random.default_rng(seed)
        r = self.rng
        HH._next = 0
        self.hh = {}
        owner, farmer = [], []
        for i in range(P["n_households"]):
            h = self._new_household(age=int(r.integers(20, 50)), gen=float(r.random()))
            # children by holder age
            for _ in range(int(r.integers(0, 5))):
                a = int(r.integers(0, max(1, min(17, h.people[0].age - 18))))
                h.people.append(Person(a, bool(r.random() < 0.5)))
            h.store = 1.0 * h.units(P) * YEAR_DAYS
            nf = int(r.integers(3, 10))
            owner += [h.id] * nf
            farmer += [h.id] * nf
        self.owner = np.array(owner)
        self.farmer = np.array(farmer)
        self.vacant_years = np.zeros(len(owner))
        ids = list(self.hh)
        for i in ids:
            for j in r.choice(ids, P["kin_links"] // 2, replace=False):
                if j != i:
                    self.hh[i].kin.add(int(j))
                    self.hh[int(j)].kin.add(i)
        mean_w = 1 - P["disaster_p"] * (1 - P["disaster_mul"])
        self.yield_per_field = P["R"] * P["ref_units"] * YEAR_DAYS / P["fields_mean"] / mean_w
        self.remedy = "land"
        self.year = 0
        self.log = []
        self.traj = {}  # id -> list of (year, owned, farmed, store, debt, landed)

    def _new_household(self, age, gen, people=None):
        r = self.rng
        if people is None:
            male = Person(age, False)
            wife = Person(max(16, age - int(r.integers(0, 5))), True, wife=True)
            people = [male, wife]
        h = HH(r, people, min(1, max(0, gen)))
        h.born = getattr(self, "year", 0)
        self.hh[h.id] = h
        return h

    # ---------------------------------------------------------------- helpers
    def need(self, h):
        return h.units(self.P) * YEAR_DAYS

    def floor(self, h):
        return self.need(h) * self.P["floor_days"] / YEAR_DAYS

    def spare(self, h):
        return h.store - self.floor(h) - self.P["reserve"] * self.need(h)

    # ---------------------------------------------------------------- the year
    def step(self):
        P, r = self.P, self.rng
        self.year += 1
        flows = dict(produced=0.0, eaten=0.0, feasted=0.0, rotted=0.0, rent=0.0, tithe=0.0, sold=0.0,
                     interest=0.0, hire=0.0, lent=0.0, kin=0.0, patron=0.0, hunger_gap=0.0, need=0.0)
        hs = self.hh
        # goodwill decay
        dec = 0.5 ** (1 / P["goodwill_half"])
        for h in hs.values():
            for k in list(h.gw):
                h.gw[k] *= dec
                if h.gw[k] < 0.5 or k not in hs:
                    del h.gw[k]
        # --- harvest
        w = float(np.exp(r.normal(0, P["weather_sd"]) - P["weather_sd"] ** 2 / 2))
        if r.random() < P["disaster_p"]:
            w *= P["disaster_mul"]
        self.weather = w
        farmed_n = {}
        for f in self.farmer:
            if f >= 0:
                farmed_n[f] = farmed_n.get(f, 0) + 1
        noise = {i: float(np.exp(r.normal(0, P["hh_sd"]) - P["hh_sd"] ** 2 / 2)) for i in hs}
        # labour: owed days to patrons reduce the client's days, add to patron's
        days = {i: h.workers(P) * P["days_per_worker"] for i, h in hs.items()}
        extra_days = {i: 0.0 for i in hs}
        for i, h in hs.items():
            for pid in list(h.owed_days):
                if pid not in hs:
                    del h.owed_days[pid]
                    continue
                spare_days = max(0, days[i] - farmed_n.get(i, 0) * P["days_per_field"])
                d = min(spare_days, h.owed_days[pid] / P["hire_cost"])
                days[i] -= d
                extra_days[pid] += d
                h.owed_days[pid] -= d * P["hire_cost"]
                if h.owed_days[pid] < 1:
                    del h.owed_days[pid]
        # rent days: 2 a tenanted field to the owner
        for fi in range(len(self.farmer)):
            o, f = self.owner[fi], self.farmer[fi]
            if f >= 0 and o != f and f in hs and o in hs:
                d = min(P["rent_days"], max(0, days[f] - farmed_n.get(f, 0) * P["days_per_field"]))
                days[f] -= d
                extra_days[o] += d
        # labour market (INV): households sell half their slack days; hirers pay 3 rations a day to the sellers
        harvest = {i: 0.0 for i in hs}
        rent_paid = {i: 0.0 for i in hs}
        rent_got = {i: 0.0 for i in hs}
        slack = {i: max(0.0, days[i] - farmed_n.get(i, 0) * P["days_per_field"]) * P["hire_share"] for i in hs}
        pool = sum(slack.values())
        pool0 = pool
        labf = {}
        for i in hs:
            nf = farmed_n.get(i, 0)
            if nf == 0:
                continue
            need_days = nf * P["days_per_field"]
            have = days[i] + extra_days[i]
            lab = min(1.0, have / need_days)
            if lab < 1 and pool > 0:
                short_days = need_days - have
                can = max(0, self.spare(hs[i])) / P["hire_cost"]
                hd = min(short_days, can, pool)
                pool -= hd
                hs[i].store -= hd * P["hire_cost"]
                flows["hire"] += hd * P["hire_cost"]
                lab = min(1.0, (have + hd) / need_days)
            labf[i] = lab
            harvest[i] = nf * self.yield_per_field * w * noise[i] * lab
        sold_days = pool0 - pool
        self.hire_slack = pool
        if sold_days > 0 and pool0 > 0:
            for i in hs:
                hs[i].store += slack[i] / pool0 * sold_days * P["hire_cost"]
        # per-field rent: proportional to the farmer's per-field harvest
        for fi in range(len(self.farmer)):
            o, f = self.owner[fi], self.farmer[fi]
            if f >= 0 and o != f and f in hs and o in hs:
                per = harvest[f] / farmed_n[f]
                rr = P["rent"] * per
                rent_paid[f] += rr
                rent_got[o] += rr
        for i, h in hs.items():
            net = harvest[i] - rent_paid[i]
            t = P["tithe"] * harvest[i]
            flows["tithe"] += t
            flows["produced"] += harvest[i]
            flows["rent"] += rent_paid[i]
            h.store += net - t + rent_got[i]
            h.rent_in = rent_got[i]
        # --- debt service at harvest (debtor eats first: pays from store above need + floor)
        for i, h in hs.items():
            if not h.debt:
                continue
            for c in list(h.debt):
                if c not in hs:
                    del h.debt[c]
                    h.unpaid.pop(c, None)
                    continue
                due = h.debt[c] * (1 + P["interest"])
                flows["interest"] += h.debt[c] * P["interest"]
                avail = max(0.0, h.store - self.need(h) - self.floor(h))
                pay = min(due, avail)
                h.store -= pay
                hs[c].store += pay
                h.debt[c] = due - pay
                if pay < 0.5 * due and h.debt[c] > 1:
                    h.unpaid[c] = h.unpaid.get(c, 0) + 1
                else:
                    h.unpaid[c] = 0
                if h.debt[c] <= 1:
                    del h.debt[c]
                    h.unpaid.pop(c, None)
                    continue
                if h.unpaid[c] >= P["default_after"] and h.debt[c] >= P["case_min_debt"]:
                    self._case(h, c)
        # --- eat, help
        short = []
        for i, h in hs.items():
            nd = self.need(h)
            flows["need"] += nd
            eat = min(nd, max(0.0, h.store))
            h.store -= eat
            flows["eaten"] += eat
            h._gap = nd - eat
            h._gap0 = h._gap / nd if nd > 0 else 0
            if h._gap > 1e-6:
                short.append(h)
        r.shuffle(short)
        for h in short:
            self._seek_help(h, flows)
        for h in hs.values():
            nd = self.need(h)
            h.hunger = min(1.0, max(0.0, h._gap / nd)) if nd > 0 else 0
            flows["hunger_gap"] += h._gap
        # --- surplus: feast, sell
        for i, h in hs.items():
            tgt = self.floor(h) + P["store_target"] * self.need(h)
            above = h.store - tgt
            if above > 0 and P["sale"] > 0:
                s = P["sale"] * above
                h.store -= s
                flows["sold"] += s
                above -= s
            if above > 0 and P["feasting"]:
                fe = P["feast_rate"] * (0.5 + h.gen) * above
                fe = min(fe, above)
                h.store -= fe
                flows["feasted"] += fe
                guests = list(h.kin & hs.keys())
                guests += [int(x) for x in r.choice(list(hs), 4)]
                guests = [g for g in guests if g != i]
                if guests:
                    per = fe * P["feast_credit"] / len(guests)
                    for g in guests:
                        h.gw[g] = h.gw.get(g, 0) + per
                h.prestige += fe / 100
            # rot
            rt = rot(max(0, h.store), self.need(h))
            h.store -= rt
            flows["rotted"] += rt
            h.prestige *= 0.8
        self._demography()
        self._brakes()
        self._landed()
        return flows

    def _case(self, h, c):
        P = self.P
        creditor = self.hh[c]
        if self.remedy == "land":
            own = np.where(self.owner == h.id)[0]
            if len(own) == 0:
                # nothing to take: the debt becomes labour
                h.owed_days[c] = h.owed_days.get(c, 0) + h.debt[c]
                del h.debt[c]
                h.unpaid.pop(c, None)
                return
            # prefer a field the debtor farms itself
            mine = [f for f in own if self.farmer[f] == h.id]
            f = (mine or list(own))[0]
            self.owner[f] = c
            if self.farmer[f] < 0:
                self.farmer[f] = h.id
            h.debt[c] -= P["field_value"]
            h.unpaid[c] = 0
            if h.debt[c] <= 1:
                del h.debt[c]
                h.unpaid.pop(c, None)
        else:
            h.owed_days[c] = h.owed_days.get(c, 0) + h.debt[c]
            del h.debt[c]
            h.unpaid.pop(c, None)

    def _seek_help(self, h, flows):
        P, hs, r = self.P, self.hh, self.rng
        if P["kin_help"]:
            kin = [hs[k] for k in h.kin if k in hs]
            # those who owe h help first; then by generosity
            kin.sort(key=lambda k: -(k.gw.get(h.id, 0) * 0 + h.gw.get(k.id, 0)) - k.gen * 10)
            for k in kin:
                if h._gap <= 0:
                    break
                owe = h.gw.get(k.id, 0)  # k owes h this much
                willing = owe + k.gen * 0.5 * max(0, self.spare(k))
                g = min(h._gap, max(0, self.spare(k)), willing)
                if g <= 0:
                    continue
                k.store -= g
                h._gap -= g
                flows["kin"] += g
                if owe > 0:
                    pay = min(owe, g)
                    h.gw[k.id] = owe - pay
                    g -= pay
                k.gw[h.id] = k.gw.get(h.id, 0) + g
        # feast guests owe the host: a host short calls in its credit from anyone
        if P["feasting"] and h._gap > 0 and h.gw:
            for k_id in sorted(h.gw, key=lambda k: -h.gw[k]):
                if h._gap <= 0:
                    break
                if k_id not in hs:
                    continue
                k = hs[k_id]
                g = min(h._gap, h.gw[k_id], max(0, self.spare(k)))
                if g <= 0:
                    continue
                k.store -= g
                h._gap -= g
                h.gw[k_id] -= g
                flows["kin"] += g
        if h._gap <= 0:
            return
        if not (P["loans"] or P["patronage"]):
            return
        # find someone with spare
        cand = [k for k in hs.values() if k.id != h.id and self.spare(k) > 1]
        if not cand:
            return
        sample = [cand[j] for j in r.choice(len(cand), min(P["lender_sample"], len(cand)), replace=False)]
        sample.sort(key=lambda k: -self.spare(k))
        for k in sample:
            if h._gap <= 0:
                break
            amt = min(h._gap, self.spare(k))
            if P["patronage"] and k.gen >= P["patron_min_gen"]:
                k.store -= amt
                h._gap -= amt
                h.owed_days[k.id] = h.owed_days.get(k.id, 0) + amt
                flows["patron"] += amt
            elif P["loans"]:
                if P["collateral"]:
                    room = (self.owner == h.id).sum() * P["field_value"] - sum(h.debt.values()) - sum(h.owed_days.values())
                    amt = min(amt, max(0.0, room))
                    if amt <= 0:
                        break
                k.store -= amt
                h._gap -= amt
                h.debt[k.id] = h.debt.get(k.id, 0) + amt
                flows["lent"] += amt

    def _demography(self):
        P, r, hs = self.P, self.rng, self.hh
        if not P["lifecycle"]:
            # households never change; just random rare extinction kept off
            return
        for i in list(hs):
            h = hs[i]
            holder = h.people[0] if h.people else None
            dead = []
            for p in h.people:
                if r.random() < hazard(p.age, h.hunger):
                    dead.append(p)
            # births
            births = []
            for p in h.people:
                if p.wife and p not in dead and 15 <= p.age < 50:
                    af = AGE_FACTOR[min(6, (p.age - 15) // 5)]
                    if r.random() < 0.32 * af * (1 - h.hunger):
                        births.append(Person(0, bool(r.random() < 0.5)))
                        if r.random() < 0.01:
                            dead.append(p)
            h.people = [p for p in h.people if p not in dead] + births
            h.claimants = [a + 1 for a in h.claimants if r.random() > hazard(a, 0)]
            for p in h.people:
                p.age += 1
            if holder is not None and holder in dead:
                self._succession(h)
                if not h.alive:
                    continue
            # children come of age
            has_heir = any(p.heir for p in h.people)
            for p in list(h.people):
                if not p.wife and not p.heir and p is not h.people[0] and p.age == 18:
                    if not has_heir:
                        p.heir = True
                        has_heir = True
                    else:
                        h.people.remove(p)
                        h.claimants.append(p.age)
                if p.heir and p.age >= 20 and h.heir_wife is None and h.hunger < 0.5:
                    if p.female:
                        h.people.append(Person(p.age + int(r.integers(0, 4)), False))
                        h.heir_wife = p
                    else:
                        wf = Person(max(18, p.age - int(r.integers(0, 4))), True)
                        h.people.append(wf)
                        h.heir_wife = wf
                    h.heir_wife.wife = True

    def _succession(self, h):
        P, r = self.P, self.rng
        heirs = [p for p in h.people if p.heir]
        adults = [p for p in h.people if p.age >= 16]
        claim0 = [a for a in h.claimants if a >= 18]
        if heirs:
            new = heirs[0]
            new.heir = False
        elif claim0:
            # an adult child who left comes home to take the farm
            a = min(claim0)
            h.claimants.remove(a)
            new = Person(a, bool(r.random() < 0.5))
            h.people.append(new)
        elif adults:
            new = max(adults, key=lambda p: p.age)
        else:
            self._extinct(h)
            return
        h.people.remove(new)
        h.people.insert(0, new)
        for p in h.people:
            p.wife = (p is h.heir_wife) and p.age < 50
        h.heir_wife = None
        # partible inheritance: share of the land to adult non-heir children
        claim = [a for a in h.claimants if a >= 18]
        h.claimants = []
        if P["partible"] > 0 and claim:
            own = list(np.where(self.owner == h.id)[0])
            r.shuffle(own)
            pot = int(round(P["partible"] * len(own) * len(claim) / (len(claim) + 1)))
            per = pot // len(claim) if claim else 0
            if per >= P["min_split"]:
                k = 0
                for a in claim:
                    child = self._new_household(age=a, gen=h.gen + r.normal(0, P["gen_inherit"]))
                    child.kin = set(h.kin) | {h.id}
                    h.kin.add(child.id)
                    for fi in own[k:k + per]:
                        self.owner[fi] = child.id
                        if self.farmer[fi] == h.id:
                            self.farmer[fi] = child.id
                    k += per
        h.gen = min(1, max(0, h.gen + r.normal(0, P["gen_inherit"]) * 0.5))

    def _extinct(self, h):
        """No adult left: the farm passes whole to a kin household's non-heir child, else to a settling family
        (INV: heirless land does not merge into another holding; the extinct household's tenancies fall vacant)."""
        hs, r = self.hh, self.rng
        h.alive = False
        kin = [hs[k] for k in h.kin if k in hs and k != h.id]
        donor = next((k for k in kin if any(a >= 18 for a in k.claimants)), None)
        if donor is not None:
            a = max(a for a in donor.claimants if a >= 18)
            donor.claimants.remove(a)
            nh = self._new_household(age=a, gen=donor.gen + r.normal(0, self.P["gen_inherit"]))
            nh.kin = {donor.id} | set(donor.kin)
        else:
            nh = self._new_household(age=int(r.integers(20, 30)), gen=float(r.random()))
            nh.kin = set(k.id for k in kin[:2])
        nh.store = max(0, h.store)
        for k in nh.kin:
            if k in hs:
                hs[k].kin.add(nh.id)
        for fi in np.where(self.owner == h.id)[0]:
            self.owner[fi] = nh.id
            if self.farmer[fi] == h.id:
                self.farmer[fi] = nh.id
        for fi in np.where(self.farmer == h.id)[0]:
            self.farmer[fi] = -1
        # debts owed to the dead household are lost; debts it owed are lost too
        del hs[h.id]

    def _brakes(self):
        P, r, hs = self.P, self.rng, self.hh
        # tenants leave: a hungry household that owns nothing and farms another's land
        own_n = np.bincount(self.owner[self.owner >= 0], minlength=HH._next + 1)
        farm_n = np.bincount(self.farmer[self.farmer >= 0], minlength=HH._next + 1)
        if P["leave_p"] > 0:
            for i in list(hs):
                h = hs[i]
                # a tenant who owns nothing, came up short on its own harvest (> 20% of need) and is in debt or owes labour
                if getattr(h, "_gap0", 0) > 0.2 and own_n[i] == 0 and farm_n[i] > 0 and (h.debt or h.owed_days or P["collateral"]):
                    if r.random() < P["leave_p"]:
                        for fi in np.where(self.farmer == i)[0]:
                            self.farmer[fi] = -1
                        for c in list(h.debt):
                            pass  # debt is lost
                        del hs[i]
        # vacant fields: owner works them itself if it has spare days, otherwise a newcomer family takes a block
        vac = np.where(self.farmer < 0)[0]
        for fi in vac:
            o = self.owner[fi]
            if o >= 0 and o in hs:
                h = hs[o]
                nf = int((self.farmer == o).sum())
                if h.workers(P) * P["days_per_worker"] > (nf + 1) * P["days_per_field"] or (getattr(self, "hire_slack", 0) > 2 * P["days_per_field"] and self.spare(h) > 3 * P["days_per_field"] * P["hire_cost"]):
                    self.farmer[fi] = o
                    continue
            if o < 0 or o not in hs:
                # unowned land is taken by a neighbour with labour
                cand = [k for k in hs.values() if k.workers(P) * P["days_per_worker"] > ((self.farmer == k.id).sum() + 1) * P["days_per_field"]]
                if cand:
                    k = cand[int(r.integers(len(cand)))]
                    self.owner[fi] = k.id
                    self.farmer[fi] = k.id
                    continue
        vac = list(np.where(self.farmer < 0)[0])
        r.shuffle(vac)
        while len(vac) >= 2:
            block, vac = vac[:4], vac[4:]
            if r.random() >= P["relet_p"]:
                continue
            # a landless grown child of the village takes the block as a tenant (INV); rarely a settling family
            donors = [k for k in hs.values() if any(18 <= a <= 40 for a in k.claimants)]
            if donors:
                d = donors[int(r.integers(len(donors)))]
                a = min(a for a in d.claimants if 18 <= a <= 40)
                d.claimants.remove(a)
                nh = self._new_household(age=a, gen=d.gen + r.normal(0, P["gen_inherit"]))
                nh.kin = {d.id} | set(list(d.kin)[:2])
            elif r.random() < 0.1:
                nh = self._new_household(age=int(r.integers(20, 30)), gen=float(r.random()))
                nh.kin = set(int(x) for x in r.choice(list(hs), 2))
            else:
                continue
            nh.store = self.need(nh) * 0.5
            for k in nh.kin:
                if k in hs:
                    hs[k].kin.add(nh.id)
            for fi in block:
                self.farmer[fi] = nh.id
                if self.owner[fi] < 0:
                    self.owner[fi] = nh.id
        # debtors' politics
        if P["politics"] is not None:
            vote, debt_vote = 0.0, 0.0
            for h in hs.values():
                v = P["landed_voice"] if own_n[h.id] >= 15 else 1.0
                if h.owed_days and P["patronage"]:
                    continue  # clients vote with their patrons
                vote += v
                if h.debt or (farm_n[h.id] > 0 and own_n[h.id] == 0):
                    debt_vote += v
            for h in hs.values():
                if h.owed_days and P["patronage"]:
                    vote += 1
            share = debt_vote / vote if vote else 0
            self.debt_share = share
            if self.remedy == "land" and share >= P["politics"]:
                self.remedy = "labour"
            elif self.remedy == "labour" and share < P["politics"] - P["politics_margin"]:
                self.remedy = "land"

    def _landed(self):
        hs = self.hh
        for h in hs.values():
            nd = self.need(h)
            ok = (h.rent_in + max(0, h.store)) >= 1.5 * nd
            h.landed_run = h.landed_run + 1 if ok else 0
            h.landed_run_h = getattr(h, "landed_run_h", 0) + 1 if h.rent_in >= 0.5 * nd else 0
            ok2 = h.rent_in >= 1.0 * nd
            h.landed_run_r = h.landed_run_r + 1 if ok2 else 0
            if h.landed_run_r >= 3:
                h.landed_ever = True

    # ---------------------------------------------------------------- metrics
    def metrics(self, flows):
        hs = self.hh
        ids = list(hs)
        owned = {i: 0 for i in ids}
        for o in self.owner:
            if o in owned:
                owned[o] += 1
        farmed = np.sum(self.farmer >= 0)
        tenanted = np.sum((self.farmer >= 0) & (self.owner != self.farmer))
        n = len(ids)
        landed_brief = sum(1 for h in hs.values() if h.landed_run >= 3)
        landed_rent = sum(1 for h in hs.values() if h.landed_run_r >= 3)
        pop = sum(len(h.people) for h in hs.values()) if self.P["lifecycle"] else n * 5
        m = dict(year=self.year, n=n, pop=pop,
                 gini=gini(list(owned.values())),
                 tenancy=tenanted / max(1, farmed),
                 vacant=float(np.mean(self.farmer < 0)),
                 landless=sum(1 for v in owned.values() if v == 0) / max(1, n),
                 landed_brief=landed_brief * 200 / max(1, n),
                 landed_rent=landed_rent * 200 / max(1, n),
                 landed_brief_n=landed_brief, landed_rent_n=landed_rent,
                 landed_half=sum(1 for h in hs.values() if getattr(h, "landed_run_h", 0) >= 3) * 200 / max(1, n),
                 big15=sum(1 for v in owned.values() if v >= 15) * 200 / max(1, n),
                 max_owned=max(owned.values()) if owned else 0,
                 tenant_short=float(np.mean([getattr(h, "_gap0", 0) > 0.05 for h in hs.values() if owned[h.id] == 0])) if any(owned[i] == 0 for i in ids) else 0.0,
                 tenant_kept=float(np.mean([1 - getattr(h, "_gap0", 0) for h in hs.values() if owned[h.id] == 0])) if any(owned[i] == 0 for i in ids) else 1.0,
                 tenant_hungry=float(np.mean([h.hunger > 0.05 for h in hs.values() if owned[h.id] == 0])) if any(owned[i] == 0 for i in ids) else 0.0,
                 hungry=sum(1 for h in hs.values() if h.hunger > 0.1) / max(1, n),
                 debtors=sum(1 for h in hs.values() if h.debt) / max(1, n),
                 clients=sum(1 for h in hs.values() if h.owed_days) / max(1, n),
                 remedy=1 if self.remedy == "labour" else 0,
                 weather=self.weather,
                 top_share=sorted(owned.values())[-max(1, n // 13):] and sum(sorted(owned.values())[-max(1, n // 13):]) / max(1, len(self.owner)),
                 )
        m.update({"f_" + k: v for k, v in flows.items()})
        return m

    def owned_vector(self):
        owned = {i: 0 for i in self.hh}
        for o in self.owner:
            if o in owned:
                owned[o] += 1
        return np.array(list(owned.values()))


def run(seed=1, record_lorenz=(), track=False, **kw):
    p = dict(P)
    p.update(kw)
    w = World(p, seed)
    rows, lor, tr = [], {}, {}
    for y in range(p["years"]):
        fl = w.step()
        rows.append(w.metrics(fl))
        if w.year in record_lorenz:
            lor[w.year] = w.owned_vector()
        if track:
            for i, h in w.hh.items():
                own = int((w.owner == i).sum())
                tr.setdefault(i, []).append((w.year, own, h.gen, h.landed_run_r >= 3, sum(h.debt.values()), max(0, h.store), len(h.owed_days) > 0))
    own = np.bincount(w.owner[w.owner >= 0], minlength=HH._next + 1)
    ids = list(w.hh)
    gens = np.array([w.hh[i].gen for i in ids])
    big = np.array([own[i] >= 15 for i in ids])
    clients = {}
    for h in w.hh.values():
        for pid in h.owed_days:
            clients[pid] = clients.get(pid, 0) + 1
    patrons5 = sum(1 for v in clients.values() if v >= 5)
    summary = dict(gen_all=float(gens.mean()), gen_big=float(gens[big].mean()) if big.any() else float("nan"),
                   n_big=int(big.sum()), patrons5=patrons5 * 200 / max(1, len(ids)),
                   max_clients=max(clients.values()) if clients else 0,
                   big_with_clients=sum(1 for i in ids if own[i] >= 15 and clients.get(i, 0) >= 3))
    out = dict(rows=rows, lorenz=lor, summary=summary)
    if track:
        out["traj"] = tr
    return out
