"""Analysis of exp_regimes results: sequences, dates, sharpness, staging, sensitivities of dates (years per +10%)."""
import numpy as np, pandas as pd, runs, collections, json
def coarse(seq):
    # drop the early flicker: keep regimes as they first appear, in order
    out = []
    for x in seq.split('>'):
        if x and x not in out: out.append(x)
    return '>'.join(out)
res = {}
base = runs.load('res_base.pkl')
B = pd.DataFrame([r['s'] for r in base])
print('BASE n=16'); print(B[['pop150','pop199','farm','town','elite','elite_hh','ratio','under1','hungry','hungry_hh','gini','tenancy','extracted','sold','estates','full','y300','y1000','late','late2','mixed']].describe(percentiles=[.1,.5,.9]).loc[['50%','10%','90%']].T.round(3).to_string())
print(collections.Counter(B.seq.map(coarse)).most_common(5)); print(collections.Counter(B.seq2).most_common(5))
for c in ['first_homes','first_town','first_food','first2_migrants M/(d-b)','first2_goods demand','first2_food S/c','full']:
    if c in B: print(c, B[c].describe()[['count','50%','min','max']].round(0).to_dict())
X = pd.read_csv('lhs_X.csv'); S = pd.read_csv('lhs_S.csv')
print('\nLHS n=300')
print('coarse growth sequences', collections.Counter(S.seq.map(coarse)).most_common(8))
print('split sequences', collections.Counter(S.seq2).most_common(6))
print('late growth regime', collections.Counter(S.late).most_common()); print('late split regime', collections.Counter(S.late2).most_common())
print('mixed share', S.mixed.describe(percentiles=[.1,.5,.9])[['50%','10%','90%']].round(2).to_dict())
# does the order change?  order of first homes vs first town vs full
def order(r):
    ev = {k: r[k] for k in ['first_homes','first_town','first_food','first_extract','first_labour','first_mates'] if k in r and not pd.isna(r[k])}
    return '>'.join(k.replace('first_','') for k,_ in sorted(ev.items(), key=lambda kv: kv[1]))
print('order of first appearance', collections.Counter(S.apply(order, axis=1)).most_common(8))
dates = ['first_homes','first_town','first2_migrants M/(d-b)','first2_goods demand','first2_food S/c','full','y300','y1000']
out = {}
for d in dates:
    if d not in S: continue
    ok = S[d].notna() & (S[d] < 999)
    y = S.loc[ok, d]; Xo = X.loc[ok]
    A = np.column_stack([np.ones(ok.sum()), Xo.values])
    coef, *_ = np.linalg.lstsq(A, y.values, rcond=None)
    pred = A @ coef; r2 = 1 - ((y - pred) ** 2).sum() / ((y - y.mean()) ** 2).sum()
    eff = {}
    for k, c in zip(X.columns, coef[1:]):
        eff[k] = c * (np.log(1.1) if not k.startswith('t_') else 1.0)   # years per +10% (per +1 year for dates)
    top = sorted(eff.items(), key=lambda kv: -abs(kv[1]))[:6]
    out[d] = dict(n=int(ok.sum()), median=float(y.median()), p10=float(y.quantile(.1)), p90=float(y.quantile(.9)), r2=float(r2), top={k: round(v, 2) for k, v in top})
    print(d, out[d])
json.dump(out, open('date_sensitivity.json','w'), indent=1)
art = runs.load('res_staging.pkl')
print('\nSTAGING')
for k, rs in art.items():
    T = pd.DataFrame([r['s'] for r in rs])
    print(k, 'seq', collections.Counter(T.seq.map(coarse)).most_common(3), '| split', collections.Counter(T.seq2).most_common(2),
          '| first homes', T.get('first_homes', pd.Series()).median(), 'full', T.full.median(), 'late', collections.Counter(T.late).most_common(2),
          'pop199', T.pop199.median(), 'town', round(T.town.median()), 'elite_hh', T.elite_hh.median(), 'hungry', round(T.hungry.median(),3), 'gini', round(T.gini.median(),2),
          'first2 dates', {c: T[c].median() for c in T if c.startswith('first2_')})
