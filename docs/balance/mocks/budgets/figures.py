"""Prototype figures for the budgets experiment. python3 figures.py (reads results.json and perturbation.csv)."""
import csv, json, os
import matplotlib
matplotlib.use('Agg')
import matplotlib.pyplot as plt
from matplotlib.patches import FancyBboxPatch, FancyArrowPatch

OUT = os.path.dirname(os.path.abspath(__file__))
R = json.load(open(os.path.join(OUT, 'results.json')))
C = dict(blue='#2a78d6', orange='#eb6834', aqua='#1baf7a', yellow='#eda100', magenta='#e87ba4', green='#008300',
         violet='#6250d6', gray='#a9a8a2', dark='#52514e', ink='#0b0b0b', surface='#fcfcfb')
plt.rcParams.update({'font.size': 10, 'axes.edgecolor': C['gray'], 'axes.labelcolor': C['dark'], 'xtick.color': C['dark'],
                     'ytick.color': C['dark'], 'figure.facecolor': C['surface'], 'axes.facecolor': C['surface'],
                     'axes.spines.top': False, 'axes.spines.right': False})


def seg_bar(ax, y, parts, h=0.6, label_min=0.035, total=None):
    x = 0
    total = total or sum(v for _, v, _ in parts)
    for name, v, col in parts:
        ax.barh(y, v, left=x, height=h, color=col, edgecolor=C['surface'], linewidth=2)
        if v / total >= label_min:
            ax.text(x + v / 2, y, f'{name}\n{v / total:.0%}', ha='center', va='center', fontsize=8,
                    color='white' if col not in (C['yellow'], C['gray'], C['magenta']) else C['ink'])
        x += v


# ------------------------------------------------------------------------- (a) food budget, today against target
f = R['accounts']['food']
t = R['food_today']['split']
fig, axs = plt.subplots(3, 1, figsize=(12, 8.2), gridspec_kw=dict(height_ratios=[2.1, 1.2, 1.2]))
ax = axs[0]
today = [('seed', t['seed'], C['gray']), ('eaten on farm', t['farm_eaten'], C['blue']), ('ale', t['ale'], C['magenta']),
         ('rots', t['rot'], C['orange']), ('no outlet\n(stored, spoils)', t['unused'], C['yellow'])]
target = [('seed', f['seed'], C['gray']), ('eaten on farm', f['farm_eaten'], C['blue']), ('rots', f['rot'], C['orange']),
          ('feast', f['feast'], C['magenta']), ('tithe', f['tithe'], C['violet']), ('rent', f['rent'], C['violet']),
          ('tax+int.', f['tax'] + f['interest'], C['violet']), ('tolls', f['toll_farm'], C['violet']), ('sold to town', f['sold'], C['aqua'])]
seg_bar(ax, 1, today)
seg_bar(ax, 0, target)
xs = f['seed'] + f['farm_eaten'] + f['rot'] + f['feast']
ax.text(xs, -0.42, f"rot {f['rot'] / f['gross']:.0%} · feast {f['feast'] / f['gross']:.0%} · taken {f['taken'] / f['gross']:.0%} (tithe {f['tithe'] / f['gross']:.0%}, "
        f"rent {f['rent'] / f['gross']:.1%}, tax+interest {(f['tax'] + f['interest']) / f['gross']:.1%}, tolls {f['toll_farm'] / f['gross']:.1%})",
        fontsize=8, va='top', ha='left', color=C['dark'])
ax.set_ylim(-0.75, 1.4)
ax.set_yticks([1, 0], ['today (measured split,\nno town, no elite)', 'target (600 farmers\nfeed 400 others)'])
ax.set_xlabel('rations a year: gross farm produce of 600 farmers at R = 1.75 (both bars the same width)')
ax.set_title('(a) Where the farms\' food goes: the same harvest, two budgets', loc='left', fontsize=11, color=C['ink'])
ax = axs[1]
town_need = f['town_need']
src = [('bought from farms', f['sold'], C['aqua']), ('elite surplus sold', f['town_from_elite_surplus'], C['violet']),
       ('town\'s own', f['town_own'], C['yellow']), ('retinue fed by elite', f['retinue_fed_by_elite'], C['green'])]
seg_bar(ax, 0, src, label_min=0.08)
ax.axvline(town_need, color=C['ink'], lw=1.5, ls='--')
ax.text(town_need, 0.42, '  town need (325 people)', fontsize=8, va='bottom', color=C['ink'])
ax.set_yticks([0], ['how the town eats'])
ax.set_xlabel('rations a year (the bar runs 5% past need: the design\'s reserve, plus the mill toll the town pays)')
ax = axs[2]
L = R['R_ladder']
lad = [('farm\'s own need', L['farm'], C['blue']), ('town (market)', L['town'], C['aqua']), ('elite', L['elite'], C['violet']),
       ('rot', L['rot'], C['orange']), ('reserve', L['town_reserve'], C['gray']), ('feast', L['feast_and_elite_slack'], C['magenta'])]
x = 0
for name, v, col in lad:
    ax.barh(0, v, left=x, height=0.6, color=col, edgecolor=C['surface'], linewidth=2)
    if v > 0.1:
        ax.text(x + v / 2, 0, f'{name}\n{v:.2f}', ha='center', va='center', fontsize=8, color='white' if col != C['gray'] else C['ink'])
    x += v
ax.text(1.0, -0.5, 'then rot .05, town reserve .02, feast .04 = 1.75 (elite net of its demesne and the town\'s toll)', fontsize=8, color=C['dark'])
ax.axvspan(1.64, 1.86, color=C['gray'], alpha=0.25, zorder=0)
ax.text(1.75, 0.62, 'measured\n1.64-1.86', ha='center', fontsize=8, color=C['dark'])
for v, lab in ((R['R_needed']['sold 0.5, rot 0.03'], 'half the surplus feasted'),
               (R['R_needed']['sold 1.0, rot 0.175'], 'today\'s rot, all sold'), (R['R_needed']['sold 0.5, rot 0.175'], 'today\'s rot, half feasted')):
    k = [1.906, 1.965, 2.147].index(round(v, 3)) if round(v, 3) in (1.906, 1.965, 2.147) else 0
    ax.plot([v, v], [-0.32, 0.32], color=C['ink'], lw=1.5)
    ax.text(v + 0.01, -0.32 + 0.0, f'{v:.2f}: {lab}', fontsize=7.5, ha='left', va='bottom', color=C['ink'], rotation=90)
ax.set_xlim(0, 2.45)
ax.set_ylim(-0.6, 1.0)
ax.set_yticks([0], ['what R must cover\n(food produced over\nfarm need, net of seed)'])
ax.set_xlabel('multiples of the farms\' own need')
fig.tight_layout()
fig.savefig(os.path.join(OUT, 'fig_a_food_budget.png'), dpi=140)
plt.close(fig)

# ------------------------------------------------------------------------- (b) growth budget with human costs
fig, ax = plt.subplots(figsize=(12, 5.2))
order = ['marriage delay', 'never marrying', 'hunger', 'disease', 'town (migration, marriage, deaths)', 'net migration (out of island, in)']
cols = [C['blue'], C['aqua'], C['orange'], C['magenta'], C['violet'], C['yellow']]
rows = [('A target budget\n(marry 23, 26% never on farms)', R['growth_budget_A']['shapley'], R['growth_budget_A']['human'])]
for k, v in R['alternatives'].items():
    rows.append((k.split(' (')[0] + '\n(' + k.split(' (')[1], v['shapley'], v['human']))
for i, (nm, sh, hu) in enumerate(rows):
    y = len(rows) - 1 - i
    x = 0
    for b, col in zip(order, cols):
        v = 100 * sh[b]
        if v >= 0:
            ax.barh(y, v, left=x, height=0.62, color=col, edgecolor=C['surface'], linewidth=2, label=b if i == 0 else None)
            if v > 0.18:
                ax.text(x + v / 2, y, f'{v:.2f}', ha='center', va='center', fontsize=8, color='white' if col != C['yellow'] else C['ink'])
            x += v
        else:
            ax.barh(y, v, left=0, height=0.62, color=col, edgecolor=C['surface'], linewidth=2, label=b if i == 0 else None)
    cost = (f"child deaths {hu['child_deaths_per_birth']:.0%} of births · never married {hu['never_married_45']:.0%}\n"
            f"life exp. {hu['e0']:.0f} · hunger {hu['hunger']:.2f} · town deaths ×{hu['D_town']:.2f} · {hu['migrants_to_town']:.1f} to town, "
            f"{hu['emigrants']:.1f} leave a year")
    ax.text(2.62, y, cost, va='center', fontsize=8, color=C['dark'])
ax.axvline(2.40, color=C['ink'], lw=1)
ax.text(2.42, -0.52, 'ceiling 2.40%/yr', ha='left', fontsize=8)
ax.set_yticks(range(len(rows)), [r[0] for r in rows][::-1], fontsize=8)
ax.set_xlim(-0.2, 4.9)
ax.set_xticks([0, 0.5, 1, 1.5, 2, 2.4])
ax.set_xlabel('points of annual growth each brake removes (Shapley split, sums to 2.40; net immigration adds a little, left of 0)')
ax.set_title('(b) The growth budget: five ways to spend the 2.4% ceiling, and what each costs people', loc='left', fontsize=11)
ax.legend(ncol=3, fontsize=8, loc='upper center', bbox_to_anchor=(0.32, -0.13), frameon=False)
fig.tight_layout()
fig.savefig(os.path.join(OUT, 'fig_b_growth_budget.png'), dpi=140)
plt.close(fig)

# ------------------------------------------------------------------------- (c) people stocks and yearly flows
P = R['people_A']['account']
fig, ax = plt.subplots(figsize=(11, 6))
ax.set_xlim(0, 11.5)
ax.set_ylim(0, 7.0)
ax.axis('off')
boxes = dict(farm=(0.6, 2.2, C['blue']), town=(6.9, 2.2, C['aqua']), elite=(3.9, 4.4, C['violet']))
for k, (x, y, col) in boxes.items():
    s = P[k]['stock']
    w = 0.9 + 3.2 * s / 600
    boxes[k] = (x, y, col, w)
    ax.add_patch(FancyBboxPatch((x, y), w, 1.1, boxstyle='round,pad=0.02', fc=col, ec='none', alpha=0.9))
    ax.text(x + w / 2, y + 0.55, f"{k}\n{s:.0f} living", ha='center', va='center', color='white', fontsize=11, weight='bold')
    ax.text(x + w / 2, y - 0.25, f"births {P[k]['births']:.1f} · deaths {P[k]['deaths']:.1f} ({P[k]['under15_deaths']:.1f} under 15)\n"
            f"marriages {P[k]['marriages']:.1f} · never married at 45: {P[k]['never_married_45']:.0%}",
            ha='center', va='top', fontsize=8, color=C['dark'])


def arrow(a, b, txt, rad=0.0, lw=1.0, tx=None):
    ax.add_patch(FancyArrowPatch(a, b, arrowstyle='-|>', mutation_scale=14, lw=lw, color=C['dark'], connectionstyle=f'arc3,rad={rad}'))
    mx, my = tx or ((a[0] + b[0]) / 2, (a[1] + b[1]) / 2)
    ax.text(mx, my, txt, fontsize=8.5, ha='center', va='center', color=C['ink'], bbox=dict(fc=C['surface'], ec='none', pad=1))


fl = P['flows']
fx, fy, _, fw = boxes['farm']
tx_, ty, _, tw = boxes['town']
ex, ey, _, ew = boxes['elite']
arrow((fx + fw, fy + 0.55), (tx_, ty + 0.55), f"{fl['farm_to_town']:.1f} a year\n(the unmarried)", lw=1 + fl['farm_to_town'] / 2)
arrow((ex + ew, ey + 0.55), (tx_ + 1.0, ty + 1.12), f"{fl['elite_to_town']:.1f}\n(younger children,\nfailed estates)", rad=-0.25,
      lw=1 + fl['elite_to_town'] / 2, tx=(tx_ + 1.9, ey + 0.55))
arrow((fx + fw * 0.5, fy + 1.12), (ex, ey + 0.55), f"{fl['farm_to_elite']:.1f}\n(a lender\nbecomes landed)", rad=-0.25, lw=1.2, tx=(fx + 0.9, ey + 0.55))
arrow((fx + 0.3, fy - 0.75), (fx + 0.3, 0.05), f"{fl['farm_out']:.1f} leave\nthe island", lw=1.2, tx=(fx + 0.3, 0.6))
arrow((tx_ + tw + 0.3, 0.3), (tx_ + tw + 0.3, ty + 0.3), f"{fl['in_town']:.1f} arrive\n(merchants)", lw=1.2, tx=(tx_ + tw + 0.3, 1.0))
arrow((ex + ew / 2, 6.3), (ex + ew / 2, ey + 1.12), f"{fl['in_elite']:.1f} arrive (an elite and retinue)", lw=1.2, tx=(ex + ew / 2, 5.95))
tot = P['total']
ax.text(0.05, 6.95, '(c) The people account at the target, one year (budget A)', fontsize=11, va='top')
ax.text(0.05, 6.6, f"births {tot['births']:.1f} − deaths {tot['deaths']:.1f} + arrivals {fl['in_town'] + fl['in_elite']:.1f} − departures "
        f"{fl['farm_out']:.1f} = 0.  Each box closes: farm births − deaths = what it sends away; the town lives on its {P['town']['in']:.1f} arrivals.",
        fontsize=8.5, va='top', color=C['dark'])
fig.savefig(os.path.join(OUT, 'fig_c_people_flows.png'), dpi=140, bbox_inches='tight')
plt.close(fig)

# ------------------------------------------------------------------------- (d) dial tornado
rows = list(csv.DictReader(open(os.path.join(OUT, 'perturbation.csv'))))
acc_col = dict(town=C['aqua'], tenant=C['orange'], labour_peak=C['yellow'], land=C['green'], elite=C['violet'], farm=C['blue'])
dials = []
for d in dict.fromkeys(r['dial'] for r in rows):
    lo = next(r for r in rows if r['dial'] == d and r['change'] == '-20%')
    hi = next(r for r in rows if r['dial'] == d and r['change'] == '+20%')
    sl = R['perturb'][d]['slack']
    dials.append((d, lo, hi, sl))
dials.sort(key=lambda z: min(float(z[1]['worst_margin']), float(z[2]['worst_margin'])))
fig, ax = plt.subplots(figsize=(12, 6.4))
for i, (d, lo, hi, sl) in enumerate(dials):
    y = len(dials) - 1 - i
    for r, side in ((lo, -1), (hi, 1)):
        v = max(-0.8, float(r['worst_margin']))
        ax.barh(y + side * 0.2, v, height=0.38, color=acc_col[r['worst']], edgecolor=C['surface'], linewidth=1)
        note = f"{r['change']}: {r['worst'].replace('_', ' ')} {float(r['worst_margin']):+.0%}"
        if r['growth_pct']:
            note += f", growth {float(r['growth_pct']):+.2f}%/yr"
        ax.text(0.15, y + side * 0.2, note, va='center', fontsize=7.5, color=C['dark'])
    s = lambda z: '>60%' if z is None else f"{z[0]:.0%} ({z[1].split(' ')[0].replace('_', ' ')})"
    ax.text(0.95, y, f"slack down {s(sl['down'])}, up {s(sl['up'])}", va='center', ha='left', fontsize=7.5, color=C['ink'])
ax.axvline(0, color=C['ink'], lw=1)
ax.set_yticks(range(len(dials)), [d[0] for d in dials][::-1])
ax.set_xlim(-0.8, 1.65)
ax.set_xticks([-0.8, -0.6, -0.4, -0.2, 0, 0.1])
ax.set_xlabel('tightest hard margin after the change (share of that account\'s need; below 0 = someone goes short). Upper bar +20%, lower −20%')
from matplotlib.patches import Patch
ax.legend(handles=[Patch(color=col, label=k.replace('_', ' ')) for k, col in acc_col.items() if k in ('town', 'tenant', 'labour_peak')],
          title='account that is tightest', fontsize=8, title_fontsize=8, loc='lower center', frameon=False, bbox_to_anchor=(0.12, 0.0))
ax.set_title('(d) Ten dials ±20%: which account breaks first. Sorted: most dangerous on top', loc='left', fontsize=11)
fig.tight_layout()
fig.savefig(os.path.join(OUT, 'fig_d_dial_tornado.png'), dpi=140)
plt.close(fig)
print('figures written')
