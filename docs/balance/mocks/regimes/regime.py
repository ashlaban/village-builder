"""Operational regimes: which limit binds, year by year.

Growth limit (the population property): each candidate limit is scored in points of annual growth it removes this year
(model.py _record, L_*): unmarried women of marrying age for want of a home (homes) or of an unbarred partner (mates); births
and deaths lost to hunger in farm households, split by whether the shortfall came from too few hands at the peak (labour), from
rent and tithe (extract), or from the land and the weather (food); the town's excess deaths and missing births (town); crowding
disease (disease). Smoothed over 9 years. The binding limit is the largest; 'ceiling' when none removes 0.25 points.

Split limit (the town property): food (S/c) when the town is hungry (hT > 0.1); goods demand when farmers want fewer goods than
the crafts and the fair offer (D < 0.9 S) and the town is fed; migrants (M/(d-b)) otherwise. Before the town: none.
Elite limit: extraction ceiling when over 30% of tenant households are hungry.
"""
import numpy as np
import pandas as pd

GROWTH = ['mates', 'homes', 'food', 'labour', 'extract', 'town', 'disease']
ORDER = ['ceiling'] + GROWTH
THR = 0.35   # the ceiling run itself shows 0.25 points of "mates" (women of 18 waiting for men of 20)


def smooth(x, k=9):
    return pd.Series(x).rolling(k, center=True, min_periods=1).mean().values


def growth_regime(df, k=9):
    L = np.vstack([smooth(df['L_' + g].values, k) for g in GROWTH]).T
    lab = np.array(GROWTH)[L.argmax(1)]
    lab = np.where(L.max(1) < THR, 'ceiling', lab)
    return lab, L


def split_regime(df):
    out = []
    hT = smooth(df['hT'].values, 5); D = smooth(df['D'].values, 5); S = smooth(df['S'].values, 5)
    for i in range(len(df)):
        if df['town'].iloc[i] < 5:
            out.append('none')
        elif hT[i] > 0.1:
            out.append('food S/c')
        elif D[i] < 0.9 * S[i]:
            out.append('goods demand')
        else:
            out.append('migrants M/(d-b)')
    return np.array(out)


def transitions(lab, min_run=8):
    """first year each regime holds for min_run years in a row; and the ordered sequence of such regimes."""
    first = {}
    seq = []
    run = 1
    for i in range(1, len(lab) + 1):
        if i < len(lab) and lab[i] == lab[i - 1]:
            run += 1
            continue
        if run >= min_run:
            r = lab[i - 1]; start = i - run
            if r not in first:
                first[r] = start
            if not seq or seq[-1] != r:
                seq.append(r)
        run = 1
    return first, seq


def sharpness(L, lab):
    """share of years where the top limit is not clearly ahead (second within 70% of the first): mixed regimes."""
    s = np.sort(L, 1)
    top, sec = s[:, -1], s[:, -2]
    act = top >= THR
    mixed = act & (sec >= 0.7 * top)
    return float(mixed.sum() / max(act.sum(), 1))
