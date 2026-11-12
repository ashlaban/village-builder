import json, people as PP, accounts as A
p, res = PP.solve(PP.BASE)
ppl = PP.account(p)
a = A.accounts(A.PAR, ppl)
def r(x):
    if isinstance(x, dict): return {k: r(v) for k, v in x.items()}
    try: return round(float(x), 3)
    except Exception: return x
for k in ('food','elite','goodwill','land','tenant','margins'): print(k, json.dumps(r(a[k])))
print('labour', json.dumps(r(a['labour'])))
print('sold', a['p']['sold'])
