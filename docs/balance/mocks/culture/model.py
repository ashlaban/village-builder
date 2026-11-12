"""Culture mock: customs diverging and converging between villages on two islands over 200 years.

Throwaway research code (not game code). One year = one step with `substeps` drift sub-steps.
Attitudes are binary-option customs: a in [0,1] is support for option 1. Rates follow src/culture.js
(social 0.5*m, anchor 0.35, noise, entrepreneurs, persuasion, 25% meeting margin) where they map.

Like-seeks-like: opinion o_ij = clip(1 - mu * d_ij, 0, 1), d_ij = mean |a_i - a_j| over customs
(or over the villages' practices with dist='prac'). Opinion multiplies (1) the weight of j's view
in i's social target, (2) the chance i marries into j's village, (3) a village's choice of gathering.
mode='adhoc' replaces it by: each differing practice adds `lam` hours of distance between two villages.
"""
import numpy as np
from scipy.cluster.hierarchy import linkage, fcluster

CUSTOMS = ['claims', 'handover', 'heirCount', 'feedOrder', 'voice', 'kinLimit']
LABELS = {
    'claims': ('kin first', 'villagers first'), 'handover': ('at marriage', 'at death'),
    'heirCount': ('heirs split/buy out', 'one heir takes all'), 'feedOrder': ('equal shares', 'workers first'),
    'voice': ('landholders', 'all heads'), 'kinLimit': ('second cousins', 'first cousins'),
}
MALL = np.array([1.0, 0.8, 0.55, 0.5, 0.3, 0.12])
NK = len(CUSTOMS)
HEIR, FEED, KIN, HAND = 2, 3, 5, 1

DEFAULT = dict(
    seed=0, years=200, substeps=4,
    # like-seeks-like
    conform=0.0,  # pull of attitudes towards the practice in force (not in the game; rate a year at malleability 1)
    mode='opinion', mu=0.0, dist='att', lam=0.0,
    # culture dynamics (src/culture.js where it maps)
    social=0.5, anchor=0.35, city_anchor=0.15, city_rate=2.2, noise=0.12, oblique=0.3,
    ent=0.004, persuasion=1.5, adv_pull=3.0, adv_weight=3.0, margin=0.25, sigma_t=0.06, adult_anchor_drift=0.02,
    # starts
    start='same', start_A=(0, 0, 0, 0, 0, 0), start_B=(1, 0, 1, 0, 1, 0),
    # geography and contact (per pair of people, per year, relative to 1 inside a village)
    geography='two_islands', sites=6, site_hours=3.0, hscale=6.0, c0=0.05, gather=0.02, kin=0.1, mar_scale=6.0,
    sea_hours=6.0, boats_start=70, boats_full=130, boats_max=1.0,
    town_year=120, town_cap=150, town_share=0.2, town_contact=2.0,
    church_year=150, church_strength=0.0, church_keys=((KIN, 0), (HAND, 1)),
    # land and demography
    K_islandA=None, K_mean=70, land_het=0.25, r=0.04, d0=0.028, bud_size=15, bud_gap=8, heir_birth_cut=0.3,
    # hardship pushes (rate per year at malleability 1; the game's self-interest pull is 0.12)
    hF=0.0, hL=0.0, famine_p=0.08, famine_scope='map', famine_pressure=2.0,
    force_hardship=None, culture_layer=True, two_centres=False, tie_margin=0.6, return_margin=0.12, tie_hours=25.0,
     # dict village->(feed, land) constant hardship for E4
)


class Sim:
    def __init__(self, **kw):
        self.p = dict(DEFAULT, **kw)
        p = self.p
        self.rng = np.random.default_rng(p['seed'])
        cap = 12000
        self.alive = np.zeros(cap, bool); self.age = np.zeros(cap); self.vil = np.zeros(cap, int); self.born = np.zeros(cap, int)
        self.att = np.zeros((cap, NK)); self.anc = np.zeros((cap, NK))
        self.adv = -np.ones(cap, int); self.adv_opt = np.zeros(cap, int); self.adv_until = np.zeros(cap)
        self.n = 0
        self._sites()
        self.t = 0
        self.hist = {}
        self.marr = []
        # founders: one village per island (or two on the one island)
        A = np.array(p['start_A']); B = np.array(p['start_B']) if p['start'] == 'different' else A
        first = [0, p['sites']] if p['geography'] != 'one_island' else [0, p['sites'] * 2 - 1]
        # the game's culture layer: cultures with customs and centres; villages leave a custom by a tie margin
        self.vcult = np.full(self.V, -1); self.cultures = []; self.fission_years = np.zeros(self.V, int)
        self.cultures.append(dict(customs=A.copy(), centres=[first[0]], founded=0, parent=-1))
        if p['start'] == 'different' or p['two_centres']:
            self.cultures.append(dict(customs=B.copy(), centres=[first[1]], founded=0, parent=-1))
        for n_, (v, cust) in enumerate(zip(first, [A, B])):
            self.exists[v] = True; self.practice[v] = cust; self.founded[v] = 0
            self.vcult[v] = min(n_, len(self.cultures) - 1)
            for _ in range(20):
                a = np.where(cust == 1, 0.78, 0.22) + self.rng.normal(0, 0.08, NK)
                self._add(v, self.rng.uniform(18, 50), np.clip(a, 0, 1), born=v)
        self.last_bud = {}
        self.splits = []
        self.tie = np.ones(self.V)

    # ---- map ----
    def _sites(self):
        p = self.p; S = p['sites']
        V = 2 * S + 1  # last is the town
        self.V = V; self.town = V - 1
        self.island = np.zeros(V, int); self.x = np.zeros(V)
        g = p['geography']
        for i in range(2 * S):
            if g == 'one_island':
                self.island[i] = 0; self.x[i] = i * p['site_hours']
            else:
                self.island[i] = i // S; self.x[i] = (i % S) * p['site_hours']
        self.island[self.town] = 2; self.x[self.town] = (S - 1) * p['site_hours'] / 2
        self.Kcap = p['K_mean'] * (1 + p['land_het'] * self.rng.uniform(-1, 1, V))
        if p['K_islandA']:
            self.Kcap[self.island == 0] *= p['K_islandA'] / p['K_mean']
        self.Kcap[self.town] = p['town_cap']
        self.exists = np.zeros(V, bool); self.practice = np.zeros((V, NK), int); self.founded = np.full(V, -1)
        # gathering sites: hosts
        if g == 'one_island':
            self.ghost = [0, 3, 6, 9]
        else:
            self.ghost = [0, 3, S, S + 3]
        self.gchoice = np.full(V, -1)

    def hours(self):
        """Travel hours between villages at time t (inf when unreachable)."""
        p = self.p; t = self.t
        H = np.abs(self.x[:, None] - self.x[None, :])
        if p['geography'] == 'well_mixed':
            H = np.full_like(H, p['site_hours'] * 2); np.fill_diagonal(H, 0)
        if p['geography'] == 'two_islands':
            cross = self.island[:, None] != self.island[None, :]
            f = np.clip((t - p['boats_start']) / max(1, p['boats_full'] - p['boats_start']), 0, 1) * p['boats_max']
            # boats: sea crossing costs sea_hours / f (infinite before boats)
            sea = np.where(f > 0, p['sea_hours'] / max(f, 1e-9), np.inf)
            H = np.where(cross, H + sea, H)
            # the town sits on the strait: 2 hours from both shores, by boat once it exists
            tw = self.town
            H[tw, :] = np.abs(self.x - self.x[tw]) + 2; H[:, tw] = H[tw, :]; H[tw, tw] = 0
        return H

    def _add(self, v, age, a, born):
        i = self.n; self.n += 1
        self.alive[i] = True; self.age[i] = age; self.vil[i] = v; self.born[i] = born
        self.att[i] = a; self.anc[i] = a; self.adv[i] = -1
        return i

    # ---- helpers ----
    def living(self):
        return np.nonzero(self.alive[:self.n])[0]

    def vmeans(self, idx):
        V = self.V
        cnt = np.bincount(self.vil[idx], minlength=V).astype(float)
        sums = np.zeros((V, NK))
        np.add.at(sums, self.vil[idx], self.att[idx])
        means = np.where(cnt[:, None] > 0, sums / np.maximum(cnt, 1)[:, None], np.nan)
        return cnt, means

    def opinion_from_d(self, d):
        return np.clip(1 - self.p['mu'] * d, 0, 1)

    def contact(self, idx, cnt, means):
        """Village-by-village contact rate per pair of people (before opinion), plus effective hours."""
        p = self.p
        H = self.hours()
        if p['mode'] == 'adhoc' and p['lam'] > 0:
            nd = (self.practice[:, None, :] != self.practice[None, :, :]).sum(2)
            H = H + p['lam'] * nd
        C = p['c0'] * np.exp(-H / p['hscale'])
        if self.t >= p['town_year']:
            C[self.town, :] *= p['town_contact']; C[:, self.town] *= p['town_contact']
        # gatherings: co-attendance adds contact
        g = self.gchoice
        same = (g[:, None] == g[None, :]) & (g[:, None] >= 0)
        C = C + p['gather'] * same
        np.fill_diagonal(C, 1.0)
        ex = self.exists.copy()
        C[~ex, :] = 0; C[:, ~ex] = 0
        return C, H

    def choose_gatherings(self, cnt, means, H):
        p = self.p
        hosts = list(self.ghost) + ([self.town] if self.t >= p['town_year'] else [])
        hosts = [h for h in hosts if self.exists[h]]
        if not hosts:
            return
        means = np.nan_to_num(means, nan=0.5)
        att_g = []
        for k, h in enumerate(hosts):
            members = [v for v in range(self.V) if self.exists[v] and self.gchoice[v] == h]
            if not members:
                members = [h]
            w = cnt[members]
            att_g.append(np.average(means[members], axis=0, weights=np.maximum(w, 1e-9)))
        att_g = np.array(att_g)
        new = np.full(self.V, -1)
        for v in range(self.V):
            if not self.exists[v] or v == self.town:
                continue
            hv = H[v, hosts]
            u = -hv / p['hscale']
            if p['mode'] == 'opinion' and p['mu'] > 0:
                if p['dist'] == 'prac':
                    d = np.array([(self.practice[v] != self.practice[h]).mean() for h in hosts])
                else:
                    d = np.abs(att_g - means[v]).mean(1)
                u = u + 3.0 * self.opinion_from_d(d)
            u = np.where(np.isfinite(hv), u, -np.inf)
            if not np.isfinite(u).any() or np.isnan(u).any():
                continue
            pr = np.exp(2.0 * (u - u.max())); pr /= pr.sum()
            new[v] = hosts[self.rng.choice(len(hosts), p=pr)]
        self.gchoice = new

    # ---- one year ----
    def step(self):
        p = self.p; rng = self.rng
        idx = self.living()
        cnt, means = self.vmeans(idx)
        C, H = self.contact(idx, cnt, means)
        self.choose_gatherings(cnt, means, H)
        C, H = self.contact(idx, cnt, means)
        self.C = C
        self.compute_ties(H)
        vi = self.vil[idx]
        C32 = C.astype(np.float32)
        W = C32[vi][:, vi]
        # kin ties: a person born elsewhere keeps ties to the village of birth (both ways)
        bi = self.born[idx]
        mover = bi != vi
        if mover.any():
            kinm = ((bi[:, None] == vi[None, :]) & mover[:, None]) | ((vi[:, None] == bi[None, :]) & mover[None, :])
            W += np.float32(p['kin']) * kinm
        np.fill_diagonal(W, 0)
        # opinion
        if p['mode'] == 'opinion' and p['mu'] > 0:
            A = self.att[idx].astype(np.float32)
            if p['dist'] == 'prac':
                pd = (self.practice[:, None, :] != self.practice[None, :, :]).mean(2).astype(np.float32)
                D = pd[vi][:, vi]
            else:
                D = np.abs(A[:, 0, None] - A[None, :, 0])
                for k in range(1, NK):
                    D += np.abs(A[:, k, None] - A[None, :, k])
                D *= np.float32(1.0 / NK)
            D *= np.float32(-p['mu']); D += 1; np.clip(D, 0, 1, out=D)
            W *= D
        self.drift(idx, W, cnt)
        self.meetings()
        self.reckoning()
        self.entrepreneurs(idx)
        self.demography(C)
        self.t += 1
        self.record()

    def hardship(self, cnt):
        """Per-village hardship this year: famine (feed) and land pressure (heirs)."""
        p = self.p; rng = self.rng; V = self.V
        press = np.clip((cnt / self.Kcap - 0.75) / 0.25, 0, 1)
        if p['force_hardship'] is not None:
            fam = np.zeros(V); land = np.zeros(V)
            for v, (f, l) in p['force_hardship'].items():
                fam[v] = f; land[v] = l
            return fam, land
        pf = p['famine_p'] * (1 + p['famine_pressure'] * press)
        if p['famine_scope'] == 'map':
            fam = np.full(V, float(rng.random() < p['famine_p']))
        elif p['famine_scope'] == 'island':
            draws = rng.random(3) < p['famine_p']
            fam = draws[self.island].astype(float)
        else:
            fam = (rng.random(V) < pf).astype(float)
        self.fam = fam
        return fam, press

    def drift(self, idx, W, cnt):
        p = self.p; rng = self.rng
        N = len(idx)
        if N == 0:
            return
        vi = self.vil[idx]
        age = self.age[idx]
        isadv = self.adv[idx] >= 0
        pw = np.where(isadv, p['adv_weight'], 1.0).astype(np.float32)
        Wp = W * pw[None, :]
        den = Wp.sum(1).astype(float)
        Wp /= np.maximum(den, 1e-12).astype(np.float32)[:, None]
        A1 = np.zeros((N, NK)); A0 = np.zeros((N, NK))
        ai = np.nonzero(isadv)[0]
        for j in ai:
            k = self.adv[idx[j]]
            (A1 if self.adv_opt[idx[j]] == 1 else A0)[j, k] = 1
        P1 = Wp @ A1.astype(np.float32); P0 = Wp @ A0.astype(np.float32)
        ageF = np.where(age < 25, 1.5, np.where(age < 50, 1.0, 0.6))[:, None]
        town = (vi == self.town)
        kindR = np.where(town, p['city_rate'], 1.0)[:, None]
        anchR = np.where(town, p['city_anchor'], p['anchor'])[:, None]
        rs = MALL[None, :] * p['social'] * kindR * ageF
        rp = p['persuasion'] * MALL[None, :] ** 0.75 * kindR * ageF
        fam, land = self.hardship(cnt)
        famv = fam[vi]; landv = land[vi]
        ramp = np.clip((self.t - p['church_year']) / 20, 0, 1) if p['church_strength'] > 0 else 0
        dt = 1.0 / p['substeps']; sq = np.sqrt(dt)
        sig = 0.354 * p['noise'] * MALL[None, :]
        advk = self.adv[idx]; advo = self.adv_opt[idx]
        for _ in range(p['substeps']):
            a = self.att[idx]
            tgt = np.where(den[:, None] > 0, Wp @ a.astype(np.float32), a)
            # oblique: the village as a whole (unfiltered by opinion, as in the game)
            vm = np.stack([np.bincount(vi, a[:, k], minlength=self.V) for k in range(NK)], 1); c = np.bincount(vi, minlength=self.V)
            vm = vm / np.maximum(c, 1)[:, None]
            tgt = (1 - p['oblique']) * tgt + p['oblique'] * vm[vi]
            da = rs * (tgt - a) + anchR * (self.anc[idx] - a) + rp * (P1 * (1 - a) - P0 * a)
            if p['conform']:
                da += p['conform'] * MALL[None, :] * (self.practice[vi] - a)
            if len(ai):
                da[ai, advk[ai]] += p['adv_pull'] * (advo[ai] - a[ai, advk[ai]])
            # hardship: famine pushes 'workers eat first', land running out pushes 'one heir takes all'
            da[:, FEED] += p['hF'] * MALL[FEED] * famv * (1 - a[:, FEED])
            da[:, HEIR] += p['hL'] * MALL[HEIR] * landv * (1 - a[:, HEIR])
            if ramp:
                for k, o in p['church_keys']:
                    da[:, k] += p['church_strength'] * ramp * np.sqrt(MALL[k]) * (o - a[:, k])
            a = a + da * dt + sig * sq * rng.standard_normal((N, NK))
            self.att[idx] = np.clip(a, 0, 1)
            ad = np.where(age < 20, 0.6, p['adult_anchor_drift'])[:, None] * dt
            self.anc[idx] += ad * (self.att[idx] - self.anc[idx])

    def meetings(self):
        p = self.p
        idx = self.living()
        cnt, means = self.vmeans(idx)
        self.changes = []
        for v in range(self.V):
            if not self.exists[v] or cnt[v] == 0:
                continue
            small = 1 + max(0, 10 - cnt[v]) * 0.1
            c = self.vcult[v]; tie = self.tie[v]
            for k in range(NK):
                s = means[v, k]; x = self.practice[v, k]
                sx, sy = (1 - s, s) if x == 0 else (s, 1 - s)
                h = p['margin']
                if p['culture_layer'] and c >= 0:
                    cust = self.cultures[c]['customs'][k]
                    h = p['margin'] + p['tie_margin'] * tie if x == cust else p['return_margin']
                h *= small
                if sy > sx * (1 + h):
                    self.practice[v, k] = 1 - x
                    self.changes.append((self.t, v, k, 1 - x))

    def compute_ties(self, H):
        self.tie = np.zeros(self.V)
        for v in range(self.V):
            c = self.vcult[v]
            if not self.exists[v] or c < 0:
                continue
            cs = self.cultures[c]['centres']
            self.tie[v] = 1.0 if v in cs else max(np.exp(-H[v, w] / self.p['tie_hours']) for w in cs)

    def reckoning(self):
        p = self.p
        if not p['culture_layer']:
            return
        idx = self.living()
        cnt, means = self.vmeans(idx)
        for ci, c in enumerate(self.cultures):
            vs = [v for v in range(self.V) if self.exists[v] and self.vcult[v] == ci and cnt[v] > 0]
            if not vs:
                continue
            w = np.array([cnt[v] * (0.3 + 0.7 * self.tie[v]) * (2 if v in c['centres'] else 1) * (3 if v == self.town else 1) for v in vs])
            agg = (w[:, None] * means[vs]).sum(0) / w.sum()
            N = cnt[vs].sum()
            Hm = p['margin'] * max(1, 0.6 + 0.4 * np.sqrt(N / 100)) * (1 + max(0, 40 - N) * 0.02)
            for k in range(NK):
                x = c['customs'][k]; s = agg[k]
                sx, sy = (1 - s, s) if x == 0 else (s, 1 - s)
                if sy > sx * (1 + Hm):
                    c['customs'][k] = 1 - x
                    for v in vs:
                        sv = means[v, k]; svx, svy = (1 - sv, sv) if x == 0 else (sv, 1 - sv)
                        if self.practice[v, k] == x and not (svx > svy * (1 + p['margin'])):
                            self.practice[v, k] = 1 - x
            # fission
            wts = 1 / MALL
            for v in vs:
                if v in c['centres']:
                    self.fission_years[v] = 0; continue
                div = (wts * (self.practice[v] != c['customs'])).sum() / wts.sum()
                if div >= 0.3 and self.tie[v] < 0.35:
                    self.fission_years[v] += 1
                else:
                    self.fission_years[v] = 0
                if self.fission_years[v] >= 3:
                    self.cultures.append(dict(customs=self.practice[v].copy(), centres=[v], founded=self.t, parent=ci))
                    self.vcult[v] = len(self.cultures) - 1; self.fission_years[v] = 0; self.tie[v] = 1.0
                    self.splits.append((self.t, v, ci))

    def entrepreneurs(self, idx):
        p = self.p; rng = self.rng
        done = (self.adv[idx] >= 0) & (self.adv_until[idx] <= self.t)
        self.adv[idx[done]] = -1
        cand = idx[(self.adv[idx] < 0) & (self.age[idx] >= 18)]
        hit = rng.random((len(cand), NK)) < p['ent'] * MALL[None, :] ** 2
        for r in np.nonzero(hit.any(1))[0]:
            i = cand[r]; k = int(np.nonzero(hit[r])[0][0])
            self.adv[i] = k; self.adv_opt[i] = 1 - self.practice[self.vil[i], k]
            self.adv_until[i] = self.t + rng.uniform(5, 15)

    def demography(self, C):
        p = self.p; rng = self.rng
        idx = self.living()
        a = self.age[idx]
        haz = 0.006 + 0.0007 * np.exp(0.07 * a)
        dead = idx[rng.random(len(idx)) < haz]
        self.alive[dead] = False
        self.age[self.living()] += 1
        idx = self.living()
        cnt, means = self.vmeans(idx)
        # coming of age (births 18 years ago, simplified): logistic on land, 'one heir' sets fewer up to marry
        new = []
        for v in range(self.V):
            if not self.exists[v] or cnt[v] == 0:
                continue
            if v == self.town:
                rate = p['d0'] - 0.012
            else:
                rate = p['d0'] + p['r'] * (1 - cnt[v] / self.Kcap[v]) * (1 - p['heir_birth_cut'] * self.practice[v, HEIR])
            nb = rng.poisson(max(0.0, cnt[v] * rate))
            members = idx[self.vil[idx] == v]
            for _ in range(nb):
                par = members[rng.integers(len(members), size=2)]
                base = 0.5 * self.att[par].mean(0) + 0.5 * means[v]
                att = np.clip(base + rng.normal(0, p['sigma_t'], NK) * np.sqrt(MALL), 0, 1)
                new.append(self._add(v, 18, att, born=v))
        new = np.array(new, int)
        # the town draws a share of the young from every village
        if self.t >= p['town_year'] and len(new):
            if not self.exists[self.town]:
                self.exists[self.town] = True; self.founded[self.town] = self.t
                # the town joins the culture with most living people, as one more centre
                sizes = np.bincount(self.vcult[self.vil[self.living()]], minlength=len(self.cultures))
                ct = int(np.argmax(sizes)); self.vcult[self.town] = ct; self.cultures[ct]['centres'].append(self.town)
                self.practice[self.town] = self.cultures[ct]['customs']
            room = self.Kcap[self.town] - (self.vil[self.living()] == self.town).sum()
            go = new[(rng.random(len(new)) < p['town_share']) & (self.vil[new] != self.town)]
            go = go[:max(0, int(room))]
            self.vil[go] = self.town
        # marriage: the young choose a spouse's village by contact, size and opinion
        idx = self.living()
        cnt, means = self.vmeans(idx)
        M = np.minimum(1.0, p['mar_scale'] * C); np.fill_diagonal(M, 1.0)
        M[:, self.town] = 0  # the town takes the young by migration, above
        young_pool = {v: idx[(self.vil[idx] == v) & (self.age[idx] <= 25)] for v in range(self.V) if self.exists[v]}
        for i in new:
            v = self.vil[i]
            if v == self.town:
                continue
            sc = M[v] * cnt
            if p['mode'] == 'opinion' and p['mu'] > 0:
                if p['dist'] == 'prac':
                    d = (self.practice != self.practice[v]).mean(1)
                else:
                    d = np.abs(np.nan_to_num(means) - self.att[i]).mean(1)
                sc = sc * self.opinion_from_d(d)
            sc = np.where(self.exists, sc, 0)
            if sc.sum() <= 0:
                continue
            w = rng.choice(self.V, p=sc / sc.sum())
            self.marr.append((self.t, v, w))
            if w != v:
                if rng.random() < 0.5 or len(young_pool.get(w, [])) == 0:
                    self.vil[i] = w
                else:
                    j = rng.choice(young_pool[w]); self.vil[j] = v
        # budding: a full village sends young adults to the island's next free site
        idx = self.living()
        cnt, _ = self.vmeans(idx)
        S = p['sites']
        groups = [list(range(2 * S))] if p['geography'] == 'one_island' else [list(range(S)), list(range(S, 2 * S))]
        for gi, sites in enumerate(groups):
            free = [s for s in sites if not self.exists[s]]
            if not free or self.t - self.last_bud.get(gi, -99) < p['bud_gap']:
                continue
            full = [s for s in sites if self.exists[s] and cnt[s] >= 0.85 * self.Kcap[s]]
            if not full:
                continue
            src = max(full, key=lambda s: cnt[s] / self.Kcap[s])
            tgt = min(free, key=lambda s: abs(self.x[s] - self.x[src]))
            pool = idx[(self.vil[idx] == src) & (self.age[idx] < 36)]
            mv = rng.choice(pool, size=min(p['bud_size'], len(pool)), replace=False)
            self.vil[mv] = tgt; self.exists[tgt] = True; self.practice[tgt] = self.practice[src]; self.vcult[tgt] = self.vcult[src]; self.founded[tgt] = self.t
            self.last_bud[gi] = self.t

    # ---- metrics ----
    def record(self):
        idx = self.living()
        cnt, means = self.vmeans(idx)
        vs = [v for v in range(self.V) if self.exists[v] and v != self.town and cnt[v] >= 8]
        h = self.hist
        def put(k, x):
            h.setdefault(k, []).append(x)
        put('t', self.t); put('pop', len(idx)); put('nvil', len(vs)); put('town', cnt[self.town])
        put('means', np.where(np.isnan(means), -1, means).copy()); put('practice', self.practice.copy()); put('vcult', self.vcult.copy()); put('ncult', len({self.vcult[v] for v in range(self.V) if self.exists[v] and v != self.town and cnt[v] > 0})); put('cnt', cnt.copy())
        nan = float('nan')
        if len(vs) >= 2:
            m = means[vs]
            dd = np.abs(m[:, None, :] - m[None, :, :]).mean(2)
            iu = np.triu_indices(len(vs), 1)
            put('D_att', dd[iu].mean())
            pr = self.practice[vs]
            pd = (pr[:, None, :] != pr[None, :, :]).mean(2)
            put('D_prac', pd[iu].mean())
            # Fst-like share of variance between villages, per custom, averaged
            vi = self.vil[idx]; keep = np.isin(vi, vs)
            A = self.att[idx[keep]]
            tot = A.var(0) + 1e-9
            w = cnt[vs] / cnt[vs].sum()
            mu_ = (w[:, None] * m).sum(0)
            btw = (w[:, None] * (m - mu_) ** 2).sum(0)
            put('Fst', (btw / tot).mean()); put('Fst_k', btw / tot)
            Z = linkage(m, 'average', metric='cityblock')
            Z[:, 2] /= NK
            lab = fcluster(Z, t=0.15, criterion='distance')
            sizes = np.bincount(lab)
            put('nclust', int((sizes >= 2).sum()))
            lab2 = fcluster(Z, t=2, criterion='maxclust')
            # sharpness: gap between the two top clusters over spread within them
            if len(set(lab2)) == 2:
                same = lab2[:, None] == lab2[None, :]
                off = ~np.eye(len(vs), dtype=bool)
                wi = dd[same & off].mean() if (same & off).any() else 0
                bt = dd[~same].mean()
                put('sharp', bt / max(wi, 1e-3)); put('gap', bt - wi)
            else:
                put('sharp', nan); put('gap', nan)
            isl = self.island[vs]
            put('island_gap', np.abs(m[isl == 0].mean(0) - m[isl == 1].mean(0)).mean() if (isl == 0).any() and (isl == 1).any() else nan)
            put('ari', ari(lab2, isl) if len(set(isl)) > 1 else nan)
            self.lab2 = dict(zip(vs, lab2))
        else:
            for k in ['D_att', 'D_prac', 'Fst', 'nclust', 'sharp', 'gap', 'island_gap', 'ari']:
                put(k, nan)
            put('Fst_k', np.full(NK, nan))
            self.lab2 = {}
        # this year's marriages
        ym = [(v, w) for (t, v, w) in self.marr if t == self.t - 1]
        inter = [(v, w) for v, w in ym if v != w]
        put('mar_inter', len(inter) / max(1, len(ym)))
        put('mar_island', sum(self.island[v] != self.island[w] for v, w in inter) / max(1, len(ym)))
        lab = getattr(self, 'lab2_prev', {})
        cross = [(v, w) for v, w in inter if v in lab and w in lab and lab[v] != lab[w]]
        put('mar_divide', len(cross) / max(1, len(inter)) if inter else nan)
        self.lab2_prev = self.lab2

    def run(self):
        for _ in range(self.p['years']):
            self.step()
        h = {k: np.array(v) for k, v in self.hist.items()}
        h['changes'] = getattr(self, 'all_changes', None)
        return h


def ari(a, b):
    """Adjusted Rand index between two labelings."""
    from scipy.special import comb
    a = np.asarray(a); b = np.asarray(b)
    ua, ia = np.unique(a, return_inverse=True); ub, ib = np.unique(b, return_inverse=True)
    M = np.zeros((len(ua), len(ub)))
    np.add.at(M, (ia, ib), 1)
    s = comb(M, 2).sum(); sa = comb(M.sum(1), 2).sum(); sb = comb(M.sum(0), 2).sum(); n = comb(len(a), 2)
    e = sa * sb / n; mx = (sa + sb) / 2
    return (s - e) / (mx - e) if mx != e else 1.0


def run(**kw):
    s = Sim(**kw)
    chg = []
    for _ in range(s.p['years']):
        s.step(); chg += s.changes
    h = {k: np.array(v) for k, v in s.hist.items()}
    h['changes'] = chg
    h['splits'] = s.splits; h['island'] = s.island; h['founded'] = s.founded; h['Kcap'] = s.Kcap
    return h
