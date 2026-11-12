"""Scale of person-to-person attitude distance d (mean |a_i - a_j| over customs) at year 100: within a village, across villages on one island, across islands."""
import numpy as np
from model import Sim
for start in ['same', 'different']:
    s = Sim(seed=0, start=start, years=100)
    for _ in range(100): s.step()
    idx = s.living(); idx = idx[s.vil[idx] != s.town]
    A = s.att[idx]; v = s.vil[idx]; isl = s.island[v]
    D = np.abs(A[:, None, :] - A[None, :, :]).mean(2)
    iu = np.triu_indices(len(idx), 1)
    same_v = (v[:, None] == v[None, :])[iu]; same_i = (isl[:, None] == isl[None, :])[iu]; d = D[iu]
    print(start, 'within village %.3f  same island other village %.3f  across islands %.3f  (p90 within %.3f)' % (
        d[same_v].mean(), d[same_i & ~same_v].mean(), d[~same_i].mean(), np.percentile(d[same_v], 90)))
