"""Q4: closing the growth gap (10 to 1,000 in about 150 years needs 3.07% a year). 24 seeds a variant."""
import numpy as np, pandas as pd, collections
import runs

V = {
    'founders alone (imm 0)': dict(imm=0),
    'baseline (1 family / 4 yr)': dict(),
    'imm 1 family / 2 yr': dict(imm=0.5),
    'imm 1 family / yr': dict(imm=1.0),
    'imm 0.5 for 60 yr only': dict(imm=0.5, imm_until=60),
    'marry 16/18 (imm 0)': dict(imm=0, amF=16, amM=18),
    'nursing 24 d (imm 0)': dict(imm=0, nurse=24),
    'child deaths x0.6 (imm 0)': dict(imm=0, child_mort=0.6),
    'all three (imm 0)': dict(imm=0, amF=16, amM=18, nurse=24, child_mort=0.6),
    '6 founding homesteads (imm 0)': dict(imm=0, n_found=6),
    'child x0.6 + imm 0.25': dict(child_mort=0.6),
    'marry 16/18 + imm 0.25': dict(amF=16, amM=18),
}

if __name__ == '__main__':
    rows = []
    for name, kw in V.items():
        res = runs.many([dict(seed=s, **kw) for s in range(24)], keep_df=False)
        S = pd.DataFrame([r['s'] for r in res])
        p = np.array([np.pad(r['df']['pop'].values, (0, 200 - len(r['df']))) for r in res])
        g = np.log(np.maximum(p[:, 100], 1) / 10) / 100 * 100
        rows.append(dict(variant=name, pop100=np.median(p[:, 100]), pop150=S.pop150.median(), p150_lo=S.pop150.quantile(.1), p150_hi=S.pop150.quantile(.9),
                         extinct=float((p[:, -1] == 0).mean()), y1000=S.y1000.median(), share1000by150=float((S.y1000 <= 150).mean()),
                         growth0_100=np.median(g), full=S.full.median(), first_homes=S.get('first_homes', pd.Series([np.nan])).median(),
                         town=S.town.median(), elite_hh=S.elite_hh.median(), ratio=S.ratio.median(), hungry=S.hungry.median(), gini=S.gini.median(),
                         tenancy=S.tenancy.median(), late=collections.Counter(S.late).most_common(1)[0][0], late2=collections.Counter(S.late2).most_common(1)[0][0]))
        print(rows[-1], flush=True)
    pd.DataFrame(rows).to_csv('growth.csv', index=False)
