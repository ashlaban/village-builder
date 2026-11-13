import sys, time
from model import run
import numpy as np
kw = eval("dict(" + (sys.argv[1] if len(sys.argv) > 1 else "") + ")")
t=time.time()
o = run(seed=1, **kw)
print("time", round(time.time()-t,1))
for m in o["rows"][::15] + [o["rows"][-1]]:
    print({k: (round(v,2) if isinstance(v,float) else v) for k,v in m.items() if not k.startswith('f_')})
rows=o["rows"]
P=sum(m['f_produced'] for m in rows)
for k in ['eaten','feasted','rotted','rent','tithe','sold','interest','lent','kin','patron','hunger_gap','need','hire']:
    print(k, round(sum(m['f_'+k] for m in rows)/P,3))
