"""Analytic extraction ceiling for a tenant: kept/need = (1 - rent - tithe) * R_h * w - rent days, where R_h is the household's
own production over need (its fields x yield / its need). Weather w from the model's distribution."""
import numpy as np
from model import P
r = np.random.default_rng(0)
sd = P["weather_sd"]
w = np.exp(r.normal(0, sd, 200000) - sd**2 / 2)
w = np.where(r.random(200000) < P["disaster_p"], w * P["disaster_mul"], w)
hh = np.exp(r.normal(0, P["hh_sd"], 200000) - P["hh_sd"]**2 / 2)
x = w * hh
mw = 1 - P["disaster_p"] * (1 - P["disaster_mul"])
q = {"median": np.median(x) / mw, "1 in 4 bad (p25)": np.percentile(x, 25) / mw, "1 in 10 bad (p10)": np.percentile(x, 10) / mw, "1 in 20 (p5)": np.percentile(x, 5) / mw}
print("year multipliers on mean R:", {k: round(v, 2) for k, v in q.items()})
for R in (1.2, 1.67, 2.0):
    print(f"R={R}: rent share at which kept falls below need:", {k: round(max(0.0, 1 - 1 / (R * v)), 2) for k, v in q.items()},
          " mean shortfall years a century at rent .25/.4/.5:",
          [round(100 * np.mean((1 - rr) * R * x / mw < 1), 0) for rr in (0.25, 0.4, 0.5)])
