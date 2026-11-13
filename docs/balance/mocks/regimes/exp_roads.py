"""Q3: roads to an elite. Elite household = unearned income (rent + interest + office: tithe and tax) >= 0.75 of its need.
Each road is switched on alone and in combinations; 16 seeds; 250 years so the ratchet after the map fills can show."""
import numpy as np
import pandas as pd
from multiprocessing import Pool
import model

OFF = dict(loans=False, offices=False, tax_road=False, patron=False, gw_land=None, escheat='free')
ROADS = {
    'none': dict(),
    'debt': dict(loans=True),
    'tithe+office': dict(offices=True),
    'life cycle + kin escheat': dict(escheat='kin'),
    'goodwill (designer road)': dict(patron=True, gw_land=2.5),
    'debt, low valve (means 1.05)': dict(loans=True, means=1.05),
    'debt + office (baseline)': dict(loans=True, offices=True),
    'office + tax road': dict(offices=True, tax_road=True),
    'all roads': dict(loans=True, offices=True, tax_road=True, patron=True, gw_land=2.5, escheat='kin'),
    'office by count (cap)': dict(offices=True, office_rule='count'),
    'debt + office, low valve': dict(loans=True, offices=True, means=1.05),
}


def one(a):
    name, seed = a
    kw = dict(OFF); kw.update(ROADS[name]); kw.update(seed=seed, years=250)
    out, w = model.run(**kw)
    rows = []
    for r in out:
        rb = r['rent_by']
        rows.append(dict(t=r['t'], pop=r['pop'], elite_hh=r['elite_hh'], elite=r['elite'], estates=r['estates'], gini=r['gini'], tenancy=r['tenancy'],
                         elite_off=r['elite_off'], hungry=r['hungry'], ratio=r['ratio_mean'], rent_clear=rb[0], rent_debt=rb[1], rent_gw=rb[2],
                         rent_esch=rb[3], office=r['office_inc'], interest=r['interest'], kin=r['kin'], patron=r['patron'], lent=r['lent'],
                         gw=r['gw'], gw_fields=r['gw_fields'], extracted=r['extracted']))
    df = pd.DataFrame(rows); df['road'] = name; df['seed'] = seed
    tr = dict(w.track); tr.update(road=name, seed=seed)
    return df, tr


if __name__ == '__main__':
    jobs = [(n, s) for n in ROADS for s in range(16)]
    with Pool(4) as p:
        res = p.map(one, jobs, chunksize=2)
    D = pd.concat([r[0] for r in res]); T = pd.DataFrame([r[1] for r in res])
    D.to_csv('roads_ts.csv', index=False); T.to_csv('roads_track.csv', index=False)
    g = D[D.t.between(145, 155)].groupby('road').median(numeric_only=True)
    g2 = D[D.t.between(230, 249)].groupby('road').median(numeric_only=True)
    pd.set_option('display.width', 250); pd.set_option('display.max_columns', 30)
    print('year 150 medians'); print(g[['pop', 'elite_hh', 'elite', 'elite_off', 'estates', 'gini', 'tenancy', 'hungry', 'ratio', 'rent_clear', 'rent_debt', 'rent_gw', 'rent_esch', 'office', 'interest', 'kin', 'patron', 'gw', 'extracted']].round(2).to_string())
    print('year 230-250 medians'); print(g2[['pop', 'elite_hh', 'elite', 'estates', 'gini', 'tenancy', 'hungry', 'ratio']].round(2).to_string())
    print(T.groupby('road').median(numeric_only=True).round(1).to_string())
