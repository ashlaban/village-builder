import model, regime, numpy as np, sys
from multiprocessing import Pool
def one(args):
    seed, kw = args
    out, w = model.run(seed=seed, **kw)
    df = model.frame(out)
    g = lambda c, a, b: float(df[c].iloc[a:b].mean())
    return dict(p100=df['pop'].iloc[100], p150=df['pop'].iloc[150], p199=df['pop'].iloc[-1], town=g('town', 180, 200), elite=g('elite', 180, 200),
                ehh=g('elite_hh', 180, 200), ratio=g('ratio_mean', 180, 200), u1=g('under1', 180, 200), hung=g('hungry', 180, 200),
                hhh=g('hungry_hh', 180, 200), hT=g('hT', 180, 200), gini=g('gini', 180, 200), ten=g('tenancy', 180, 200),
                ext=g('extracted', 180, 200), sold=g('sold', 180, 200), est=g('estates', 180, 200), full=int(np.argmax(df.villages.values >= w.q['n_sites'])))
def show(kw, seeds=8, label=''):
    with Pool(4) as p:
        rs = p.map(one, [(s, kw) for s in range(seeds)])
    keys = rs[0].keys()
    print(label or kw, ' '.join(f'{k}={np.median([r[k] for r in rs]):.3g}' for k in keys))
if __name__ == '__main__':
    kw = dict(eval('dict(' + ','.join(sys.argv[1:]) + ')'))
    show(kw)
