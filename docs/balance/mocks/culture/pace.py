"""Pace check: practice changes per custom under drift only (no hardship, no church), and first-change years."""
import numpy as np, sys
from model import run, CUSTOMS
from multiprocessing import Pool
def one(seed, **kw):
    h = run(seed=seed, **kw)
    return h['changes']
if __name__ == '__main__':
    kw = eval('dict(' + (sys.argv[1] if len(sys.argv) > 1 else '') + ')')
    with Pool(4) as pool:
        res = pool.starmap(one, [(s,) for s in range(8)]) if not kw else pool.map(__import__('functools').partial(one, **kw), range(8))
    for k, name in enumerate(CUSTOMS):
        n = [sum(1 for c in r if c[2] == k) for r in res]
        first = [min([c[0] for c in r if c[2] == k] or [999]) for r in res]
        print(f'{name:10s} changes/run {np.mean(n):6.1f}  first change (median yr) {np.median(first)}')
