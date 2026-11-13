"""Q5 test: predictions written from the dial table (predictions.json) against the model, +20% on five dials (child_mort -20%).
40 seeds per arm, same seeds in every arm. Year 150 = mean of years 145-155."""
import json, numpy as np, pandas as pd
import runs, model

DIALS = {'means': 1.2, 'tithe': 1.2, 'Wd1': 1.2, 'town_d': 1.2, 'child_mort': 0.8}
PROPS = ['pop', 'town_share', 'elite_hh', 'ratio', 'hungry_pts', 'gini_pts']
N = 40


def props(res):
    rows = []
    for r in res:
        d = r['df']; w = d[(d.t >= 145) & (d.t <= 155)]
        rows.append(dict(pop=w['pop'].mean(), town_share=(w.town / w['pop']).mean(), elite_hh=w.elite_hh.mean(), ratio=w.ratio_mean.mean(),
                         hungry_pts=100 * w.hungry.mean(), gini_pts=100 * w.gini.mean()))
    return pd.DataFrame(rows)


if __name__ == '__main__':
    base = props(runs.many([dict(seed=s) for s in range(N)]))
    pred = json.load(open('predictions.json'))
    rows = []
    for k, m in DIALS.items():
        P = props(runs.many([dict(seed=s, **{k: model.BASE[k] * m}) for s in range(N)]))
        for p in PROPS:
            d = P[p] - base[p]
            if p in ('hungry_pts', 'gini_pts'):
                eff = d.mean(); se = d.std() / np.sqrt(N)
            else:
                eff = 100 * d.mean() / base[p].mean(); se = 100 * d.std() / np.sqrt(N) / base[p].mean()
            pr = pred[k][p]
            sig = abs(eff) > 2 * se and abs(eff) >= 2
            dir_ok = (np.sign(pr) == np.sign(eff)) if sig else (abs(pr) < 2.5)
            size_ok = (abs(eff) < 2.5 and abs(pr) < 2.5) or (pr != 0 and eff != 0 and np.sign(pr) == np.sign(eff) and 0.5 <= abs(eff) / abs(pr) <= 2)
            rows.append(dict(dial=k, prop=p, predicted=pr, measured=round(eff, 2), se=round(se, 2), significant=bool(sig), direction_ok=bool(dir_ok), size_ok=bool(size_ok)))
    df = pd.DataFrame(rows)
    df.to_csv('dial_test.csv', index=False)
    print(df.to_string())
    print('direction right', df.direction_ok.mean().round(2), 'size right (x2)', df.size_ok.mean().round(2))
    print('among significant effects: direction', df[df.significant].direction_ok.mean().round(2), 'size', df[df.significant].size_ok.mean().round(2), 'n', df.significant.sum())
    print('base', base.mean().round(3).to_dict())
