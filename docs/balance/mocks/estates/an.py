import pickle, numpy as np, sys
from collections import defaultdict
def load(n): return pickle.load(open(f'results/{n}.pkl','rb'))
def group(res):
    g=defaultdict(list)
    for r in res: g[r['label']].append(r)
    return g
def ser(runs,k): return np.array([[m[k] for m in r['rows']] for r in runs])
def endmean(runs,k,a=130,b=150): return ser(runs,k)[:,a:b].mean()
def flows(runs,a=20,b=150):
    keys=[k for k in runs[0]['rows'][0] if k.startswith('f_')]
    tot={k:sum(m[k] for r in runs for m in r['rows'][a:b]) for k in keys}
    return tot
