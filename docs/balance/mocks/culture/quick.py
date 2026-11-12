import time, sys, numpy as np
from model import run
kw = eval('dict(' + (sys.argv[1] if len(sys.argv) > 1 else '') + ')')
t=time.time(); h=run(**kw); print('secs', round(time.time()-t,1), 'splits', h['splits'])
print('yr pop nv town D_att D_prac Fst isl_gap ncl ncult sharp mar_inter mar_isl mar_div')
for y in list(range(0,200,15))+[199]:
    print(y, h['pop'][y], h['nvil'][y], int(h['town'][y]), *(round(float(h[k][y]),3) for k in ['D_att','D_prac','Fst','island_gap','nclust','ncult','sharp','mar_inter','mar_island','mar_divide']))
