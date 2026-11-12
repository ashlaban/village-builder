"""Aggregate json/*.json (analyze.js) and labour/*.json into tables (markdown to stdout, and summary.json)."""
import json, glob, os, re, statistics as S
M = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
J = os.path.join(M, 'json'); L = os.path.join(M, 'labour'); R = os.path.join(M, 'runs')

def load(scen, seed, y):
    p = os.path.join(J, f'{scen}-s{seed}-y{y}.json')
    return json.load(open(p)) if os.path.exists(p) else None

def ms(xs, nd=2):
    xs = [x for x in xs if x is not None]
    if not xs: return '-'
    m = S.mean(xs)
    if len(xs) == 1: return f'{m:.{nd}f}'
    return f'{m:.{nd}f} ({min(xs):.{nd}f}-{max(xs):.{nd}f})'

SEEDS = {'founders': [3, 5, 7, 11, 42], 'populous': [3, 7, 11]}
summary = {}

def last_year(scen, seed):
    ys = [int(re.search(r'-y(\d+)\.json', f).group(1)) for f in glob.glob(os.path.join(J, f'{scen}-s{seed}-y*.json'))]
    return max(ys) if ys else None

def yearly(scen, seed):
    rows = {}
    for f in sorted(glob.glob(os.path.join(R, f'{scen}-small-s{seed}-y*.log'))):
        for line in open(f):
            m = re.match(r'^\s+(\d+)\s+(\d+)\s+(\d+)\s+(.*?)\s{2,}(\d+)\s+(\d+)\s+([\d.]+)\s+(\d+)\s+([\d.]+)\s*$', line)
            if m: rows[int(m.group(1))] = dict(pop=int(m.group(2)), births=int(m.group(3)), marriages=int(m.group(5)), hungryDays=int(m.group(6)), meanGrain=float(m.group(7)), ms=float(m.group(9)))
    return rows

out = []
for scen, seeds in SEEDS.items():
    out.append(f'\n## {scen}\n')
    # demography per decade from each seed's last save
    finals = {s: load(scen, s, last_year(scen, s)) for s in seeds if last_year(scen, s)}
    out.append('| decade | pop end | growth %/yr | TFR | q1 | q15 | first marriage F | M | deaths: ' + ' / '.join(['infancy', 'childhood', 'illness', 'childbirth', 'oldAge', 'hunger', 'starvation']) + ' |')
    out.append('|---|---|---|---|---|---|---|---|---|')
    nd = max(len(d['decades']) for d in finals.values())
    for i in range(nd):
        ds = [d['decades'][i] for d in finals.values() if len(d['decades']) > i]
        causes = {}
        for k in ['infancy', 'childhood', 'illness', 'childbirth', 'oldAge', 'hunger', 'starvation']:
            causes[k] = sum(x['causes'].get(k, 0) for x in ds)
        tot = sum(causes.values()) or 1
        cs = ' / '.join(f'{100*causes[k]/tot:.0f}' for k in causes)
        out.append(f"| {ds[0]['from']}-{ds[0]['to']} | {ms([x['popEnd'] for x in ds],0)} | {ms([x['growthPerYear'] for x in ds],1)} | {ms([x['tfr'] for x in ds],1)} | {ms([x['periodQ1'] for x in ds])} | {ms([x['periodQ15'] for x in ds])} | {ms([x['firstMarriageAgeF'] for x in ds],1)} | {ms([x['firstMarriageAgeM'] for x in ds],1)} | {cs} (n={tot}) |")
    # pooled over all decades
    pool = {}
    for d in finals.values():
        for x in d['decades']:
            for k, v in x['causes'].items(): pool[k] = pool.get(k, 0) + v
    out.append(f'\nDeaths pooled: {pool}')
    out.append('Never married (alive, 45+): ' + ', '.join(f"s{s}: {d['neverMarried']['age45plus']['share']} of {d['neverMarried']['age45plus']['n']}" for s, d in finals.items()))
    out.append('Never married (alive, 30+): ' + ', '.join(f"s{s}: {d['neverMarried']['age30plus']['share']} of {d['neverMarried']['age30plus']['n']}" for s, d in finals.items()))
    # snapshot table per decade
    out.append('\n| year | households | size | single % | need/yr | produced/need | seed:yield | hh med (p10-p90) | grain split % of harvest: seed / rot hh / to village store / eaten grain / brewed / gifts | fish+meat+milk % of food | stored grain / need | days held p10/p50/p90 | days Gini | <48 days % | fields/hh | field Gini | land owned % | gw pairs | gw/hh | gw top3 % | gifts/yr | cultures | practice diff mean/max | custom changes | splits |')
    out.append('|' + '---|' * 26)
    ys = sorted({int(re.search(r'-y(\d+)\.json', f).group(1)) for f in glob.glob(os.path.join(J, f'{scen}-s*-y*.json'))})
    summary[scen] = {}
    for y in ys:
        ds = [load(scen, s, y) for s in seeds]; ds = [d for d in ds if d]
        if not ds: continue
        def fl(d, k): return S.mean([f[k] for f in d['flows']]) if d['flows'] else None
        prod, split, other, stock = [], [], [], []
        for d in ds:
            h = fl(d, 'harvest'); sd = fl(d, 'seed'); nonGrain = sum(fl(d, k) for k in ['milk', 'butter', 'meat', 'catch', 'gathering'])
            need = d['yearNeedNow']
            prod.append((h - sd + nonGrain) / need if need else None)
            split.append([100 * fl(d, k) / h for k in ['seed', 'spoilGrain', 'toVillageStore', 'eatenGrainCooked', 'brewGrain', 'giftGrainOut']] + [100 * fl(d, 'eatenGrainRaw') / h])
            other.append(100 * nonGrain / (h - sd + nonGrain))
            stock.append((d['storeNow']['householdGrain'] + d['storeNow']['villageGrain']) / need)
        sp = ' / '.join(f'{S.mean(x[i] for x in split):.0f}' for i in range(6))
        gifts = []
        for d in ds:
            g = d['goodwill']['giftsByYear']; yy = [int(k) for k in g if y - 3 < int(k) <= y]
            gifts.append(S.mean(g[str(k)]['n'] for k in yy) if yy else 0)
        hm = [S.mean([f['hhSeedYieldMedian'] for f in d['flows'] if f['hhSeedYieldMedian'] is not None] or [0]) for d in ds if d['flows']]
        p10 = [S.mean([f['hhSeedYieldP10'] for f in d['flows'] if f['hhSeedYieldP10'] is not None] or [0]) for d in ds if d['flows']]
        p90 = [S.mean([f['hhSeedYieldP90'] for f in d['flows'] if f['hhSeedYieldP90'] is not None] or [0]) for d in ds if d['flows']]
        row = f"| {y} | {ms([d['households']['n'] for d in ds],0)} | {ms([d['households']['meanSize'] for d in ds],1)} | {ms([100*d['households']['single'] for d in ds],0)} | {ms([d['yearNeedNow'] for d in ds],0)} | {ms(prod)} | {ms([d['flows'][-1] and S.mean(f['seedYield'] for f in d['flows']) for d in ds])} | {S.mean(hm):.1f} ({S.mean(p10):.1f}-{S.mean(p90):.1f}) | {sp} | {ms(other,0)} | {ms(stock,1)} | {S.mean(d['foodAtSave']['daysHeldDeciles'][0] for d in ds):.0f}/{S.mean(d['foodAtSave']['daysHeldDeciles'][2] for d in ds):.0f}/{S.mean(d['foodAtSave']['daysHeldDeciles'][4] for d in ds):.0f} | {ms([d['foodAtSave']['daysHeldGini'] for d in ds])} | {ms([100*d['foodAtSave']['shareBelow48Days'] for d in ds],0)} | {ms([d['land']['fieldsPerHH'] for d in ds],1)} | {ms([d['land']['fieldsGini'] for d in ds])} | {ms([100*d['land']['ownedShare'] for d in ds],0)} | {ms([d['goodwill']['pairs'] for d in ds],0)} | {ms([d['goodwill']['perHH'] for d in ds],0)} | {ms([100*d['goodwill']['top3Share'] for d in ds],0)} | {ms(gifts,0)} | {ms([d['culture']['cultures'] for d in ds],0)} | {ms([d['culture']['meanPracticeDiff'] for d in ds],1)}/{max(d['culture']['maxPracticeDiff'] for d in ds)} | {ms([d['culture']['customEvents'] for d in ds],0)} | {ms([d['culture']['splitEvents'] for d in ds],0)} |"
        out.append(row)
        summary[scen][y] = dict(n=len(ds), produced=prod, split=split, stock=stock)
    # yearly series: hungry days and growth
    for s in seeds:
        yr = yearly(scen, s)
        if yr:
            ks = sorted(yr)
            out.append(f"\n{scen} s{s} pop by decade: " + ', '.join(f"y{k}:{yr[k]['pop']}" for k in ks if k % 10 == 0 or k == 1) + '; hungry household-days per year, mean per decade: ' +
                       ', '.join(f"{d}-{d+9}: {S.mean(yr[k]['hungryDays'] for k in ks if d <= k < d+10):.0f}" for d in range(1, max(ks), 10)) + '; ms/day last: ' + str(yr[ks[-1]]['ms']))

# labour
out.append('\n## labour (idle report, one year from the save)\n')
out.append('| save | role | spring idle | summer idle | autumn idle | winter idle | walking+carrying summer | hungry hh share | hungry people share |')
out.append('|---|---|---|---|---|---|---|---|---|')
for f in sorted(glob.glob(os.path.join(L, '*-idle.json'))):
    if os.path.getsize(f) == 0: continue
    n = os.path.basename(f)[:-10]
    d = json.load(open(f)); hs = d['hoursShare']
    hu = os.path.join(L, n + '-hunger.json'); hsum = json.load(open(hu))['summary'] if os.path.exists(hu) and os.path.getsize(hu) else {}
    for role in ['farmer', 'wife', 'son', 'daughter']:
        if role not in hs: continue
        r = hs[role]; g = lambda s, k='idle': r.get(s, {}).get(k, '-')
        wc = (r['summer']['walking'] + r['summer']['carrying']) if 'summer' in r else '-'
        out.append(f"| {n} | {role} | {g('spring')} | {g('summer')} | {g('autumn')} | {g('winter')} | {wc} | {hsum.get('hungryHouseholdShare','-')} | {hsum.get('hungryPeopleShare','-')} |")
out.append('\nhours report: share of workers\' working hours on jobs (work+walk), by field group')
for f in sorted(glob.glob(os.path.join(L, '*-hours.json'))):
    if os.path.getsize(f) == 0: continue
    d = json.load(open(f)); n = os.path.basename(f)[:-11]
    parts = []
    for g in d['groups']:
        tot = sum(x['total'] for x in g['hours'])
        farm = sum(x['total'] for x in g['hours'] if x['kind'] in ('plow', 'sow', 'weed', 'reap', 'haul', 'thresh', 'manure'))
        parts.append(f"{g['group']} (n={g['households']}): busy {100*tot/g['workersHours']:.0f}%, fields work {100*farm/g['workersHours']:.0f}%")
    out.append(f'- {n}: ' + '; '.join(parts))
print('\n'.join(out))
json.dump(summary, open(os.path.join(M, 'summary.json'), 'w'))
