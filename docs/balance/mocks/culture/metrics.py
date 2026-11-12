"""Post-hoc metrics on a run's history (villages only, the town excluded)."""
import numpy as np
from scipy.cluster.hierarchy import linkage, fcluster
from model import MALL, NK

W = 1 / MALL; W = W / W.sum()  # hard customs count most, as the game's fission divergence does


def villages(h, t, minn=8):
    cnt = h['cnt'][t]; V = len(cnt)
    return [v for v in range(V - 1) if cnt[v] >= minn]


def island_gap(h, t, weighted=False):
    """Distance between the two islands' size-weighted mean attitudes (mean over customs)."""
    vs = villages(h, t); isl = h['island']
    a = [v for v in vs if isl[v] == 0]; b = [v for v in vs if isl[v] == 1]
    if not a or not b:
        return np.nan
    m = h['means'][t]; c = h['cnt'][t]
    ma = np.average(m[a], 0, c[a]); mb = np.average(m[b], 0, c[b])
    d = np.abs(ma - mb)
    return float((d * W).sum() if weighted else d.mean())


def island_prac_gap(h, t):
    """Share of customs (weighted by 1/malleability) on which the islands' majority practice differs, size-weighted."""
    vs = villages(h, t); isl = h['island']
    a = [v for v in vs if isl[v] == 0]; b = [v for v in vs if isl[v] == 1]
    if not a or not b:
        return np.nan
    P = h['practice'][t]; c = h['cnt'][t]
    pa = np.average(P[a], 0, c[a]); pb = np.average(P[b], 0, c[b])
    return float(np.abs(pa - pb).mean())


def prac_blocks(h, t, cut=0.25):
    """Clusters of villages by practice (average linkage on the share of customs that differ); blocks = clusters holding >= 15% of people."""
    vs = villages(h, t)
    if len(vs) < 2:
        return 1, np.nan
    P = h['practice'][t][vs].astype(float); c = h['cnt'][t][vs]
    Z = linkage(P, 'average', metric='hamming')
    lab = fcluster(Z, t=cut, criterion='distance')
    share = np.array([c[lab == l].sum() for l in np.unique(lab)]) / c.sum()
    return int((share >= 0.15).sum()), float(share.max())


def bimodality(h, t):
    """Sharpness: across villages, the between-island share of the variance of mean attitudes (1 = two clean blocks by island)."""
    vs = villages(h, t); isl = h['island'][vs]
    if len(set(isl)) < 2:
        return np.nan
    m = h['means'][t][vs]
    tot = ((m - m.mean(0)) ** 2).sum()
    btw = sum(((isl == i).sum() * ((m[isl == i].mean(0) - m.mean(0)) ** 2).sum()) for i in (0, 1))
    return float(btw / max(tot, 1e-12))


def series(h, f, **kw):
    return np.array([f(h, t, **kw) for t in range(len(h['t']))])


def smooth(x, k=9):
    x = np.asarray(x, float)
    out = np.full_like(x, np.nan)
    for i in range(len(x)):
        w = x[max(0, i - k // 2): i + k // 2 + 1]
        w = w[~np.isnan(w)]
        if len(w):
            out[i] = w.mean()
    return out
