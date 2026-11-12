"""Conservation checks: the food budget and the people budget, year by year."""
import sys, json
import numpy as np
import model

p = json.load(open(sys.argv[1])) if len(sys.argv) > 1 else {}
df = model.frame(model.run(p)[0])
# farm food: P + S_old = own eaten + rent + tithe + repay + sold + feast + rot + S_new
lhs = df.P + df.S
rhs = df.own_eaten + df.rent + df.tithe + df.rep + df.sold + df.feast + df.rot + (df.S + df.dS)
farm_res = (lhs - rhs).abs().max()
# elite pool: rent + tithe + repay = elite eat + lent + gifts + passed to town + rot
el_res = ((df.rent + df.tithe + df.rep) - (df.eliteate + df.borrow + df.gift + df.passed + df.elite_rot)).abs().max()
# people
pop_next = df['pop'].shift(-1)
ppl_res = (pop_next - df['pop'] - (df.births + df.bT + df.bE - df.deaths + df.imm - df.emig)).abs()[:-1].max()
cls_res = (df['pop'] - df.farm - df['T'] - df['E']).abs().max()
print(f"farm food residual {farm_res:.2e}; elite pool residual {el_res:.2e}; people residual {ppl_res:.2e}; classes {cls_res:.2e}")
# the brief's split: produced = eaten + taken + feasted + sold + rotted (+ stored)
tot = df[df.t >= 150][['P', 'own_eaten', 'rent', 'tithe', 'rep', 'tax', 'sold', 'feast', 'rot', 'dS']].sum()
P = tot.P
print('years 150-199, share of food produced:')
for k in ['own_eaten', 'rent', 'tithe', 'rep', 'sold', 'feast', 'rot', 'dS']:
    print(f'  {k:10s} {tot[k] / P:6.3f}')
print(f"  of which the silver tax (inside 'sold', a value flow counted again as 'taken'): {tot.tax / P:.3f}")
print(f"  'share extracted' as the table defines it (rent+tithe+tax+interest) {((tot.rent + tot.tithe + tot.tax + tot.rep) / P):.3f};"
      f" extracted+sold without double count {((tot.rent + tot.tithe + tot.rep + tot.sold) / P):.3f}")
