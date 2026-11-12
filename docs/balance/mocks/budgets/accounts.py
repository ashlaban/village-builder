"""Six accounts for one year at the target (1,000 living: 600 farm / 325 town / 75 elite), in rations, people and days.

Throwaway research code (round 2, budgets). Every parameter carries a source tag:
  G game rule (src/sim), M measured on the game (round 1, measure/tables.md), D design number (brief, slice 5),
  R round-1 mock result, I invented here.
The people account comes from people.py (a three-class cohort model at the game's demography).
"""
import math
from copy import deepcopy

DAYS = 48  # G a year is 48 game days

# --------------------------------------------------------------------------------------------- parameters
PAR = dict(
    # food production
    R=1.75,            # M food produced over need, net of seed, farm households (1.64 to 1.86)
    grain_share=0.52,  # M grain's share of food produced net of seed (fish, meat, milk, gathering 39-52%)
    seed_yield=2.9,    # M seed to yield at year 50 (3.7 at year 10)
    hh_size=4.7,       # M farm household size (4.4 to 5.4)
    fields_hh=3.4,     # M fields a farm household (3.3 to 3.5)
    meadows_hh=2.7,    # M meadows a farm household (2.1 to 3.2)
    rot=0.03,          # I target share of farm produce rotting (store bands at about 1.2 years of grain held; today 0.175)
    bad_year=0.75,     # I a 1-in-4 bad year's grain harvest, as a share of an ordinary one
    # extraction (claims, in order: tithe, rent, tax, interest, tolls)
    tithe=0.10,        # D a tenth of the gross produce
    rent=0.25,         # D a quarter of a tenant field's grain harvest
    rent_days=2,       # D owed days a tenant field a year (per field: estates mock's reading, I)
    tax=0.03,          # I tax asked in silver, share of farm produce (sold to raise it: counted once, as taken)
    interest=0.01,     # R interest paid, share of farm produce (estates mock: rent and interest 6-10%)
    toll=1 / 16,       # I mill toll on grain eaten (historical multure)
    hire=3,            # D a hired day costs 3 rations
    days_field=8,      # M/R worker-days a field a year (measured: field work 19-23% of hours, 3.4 fields; estates mock 8)
    # elite
    elite_hh=13.5,     # D 12 to 15 households
    elite_mult=1.5,    # I an elite person consumes 1.5 rations a ration-unit (meat, ale, horses, guests)
    retinue_hh=4,      # I retinue and servants an elite household feeds (counted in the town class)
    hospitality=0.15,  # I elite feasting, share of its own need
    demesne_hh=5,      # I fields an elite household works itself (owed days, then hired hands)
    elite_reserve=0.10,  # I income over requirement the design aims for
    # town
    town_own=0.15,     # I share of town need the town produces itself (fishers, gardens, pigs)
    town_reserve=0.05,  # I town supply over need the design aims for
    sold=None,         # solved: share of the farm's disposable surplus sold (the rest is feasted or given)
    tenant_fields=None,  # solved only on request (elite_options); else tenancy x farm fields
    tenancy=0.15,      # R tenancy share of farm fields (estates mock: 14-19% at years 80-150)
    # goodwill
    gw_half=4.0,       # G goodwill halves in 4 years
    gw_target=88,      # M rations outstanding a household
    help_gw=15.25,     # M goodwill booked from help a household a year that holds the measured 88 (gifts 8% of grain, net of repayment)
    feast_credit=0.5,  # I goodwill a guest owes a ration feasted
    # labour (farm adults 15-59; shares of their hours)
    idle=dict(spring=0.31, summer=0.335, autumn=0.24, winter=0.64),  # M populous y50, farmers and wives
    walk_share=0.39,   # M walking and carrying, share of busy hours outside winter (30-47%)
    field_share_autumn=0.30,  # I own field work, share of autumn hours
    demesne_season=dict(spring=3 / 8, summer=1 / 8, autumn=4 / 8, winter=0.0),  # I a demesne field's work by season
    peak_buffer=0.10,  # I share of peak hours kept free (weather, sickness)
    craft_days=40,     # R/I working days a craft worker a year
    craft_share=0.5,   # I share of town workers in craft
    # land
    villages=30,       # M medium map at year 10
    reach_fields=24,   # M/I fields a village's day-walk holds at saturation (small y50: 597 fields, 25 villages, 45 waiting)
    land_tiles=20082,  # M medium map
)

def tags():
    import re
    out = {}
    for line in open(__file__):
        m = re.match(r"\s+(\w+)=.*#\s*([GMDRI/]+)\s", line)
        if m:
            out[m.group(1)] = m.group(2)
    return out


# --------------------------------------------------------------------------------------------- the accounts
def accounts(p, ppl, solve_sold=True, solve_tenants=False):
    """p: parameters; ppl: people.account() at the target. Returns a dict of accounts and margins.
    With solve, tenant fields and the share sold are solved to meet the elite's and the town's reserves."""
    p = dict(p)
    F, T, E = ppl['farm'], ppl['town'], ppl['elite']
    need_unit = DAYS
    farm_need = F['units'] * need_unit
    town_unit = T['units'] / T['stock']
    town_need = T['units'] * need_unit
    elite_own = E['units'] * need_unit * p['elite_mult']
    farm_hh = F['stock'] / p['hh_size']
    fields = farm_hh * p['fields_hh']

    # production. R is measured at today's yield and 3.4 fields; yield and fields scale the grain part.
    base_grain_net = PAR['R'] * PAR['grain_share'] * farm_need  # grain net of seed at measured yield and fields
    seed0 = base_grain_net / (PAR['seed_yield'] - 1)
    seed_per_field = seed0 / (farm_hh * PAR['fields_hh'])  # seed a field takes (fixed by sowing)
    seed = seed_per_field * fields
    scale = p['R'] / PAR['R']  # R scales all food at measured yield and fields
    grain_net = seed * (p['seed_yield'] - 1) * scale
    grain_gross = grain_net + seed
    other = PAR['R'] * (1 - PAR['grain_share']) * farm_need * scale
    P = grain_net + other            # food produced net of seed
    gross = P + seed
    net_field = grain_net / fields   # grain net a field
    gross_field = grain_gross / fields

    # claims on the farm
    tithe = p['tithe'] * gross
    tax = p['tax'] * P
    interest = p['interest'] * P
    toll_farm = p['toll'] * p['grain_share'] * farm_need
    rot = p['rot'] * P

    # the elite's requirement
    retinue = p['elite_hh'] * p['retinue_hh']
    retinue_need = retinue * town_unit * need_unit
    elite_req = elite_own * (1 + p['hospitality']) + retinue_need
    toll_town = p['toll'] * p['grain_share'] * (town_need - retinue_need)
    demesne = p['elite_hh'] * p['demesne_hh']
    rent_field = p['rent'] * gross_field

    def elite_income(Tf):
        owed = p['rent_days'] * Tf
        dem_days = demesne * p['days_field']
        hired = max(0.0, dem_days - owed)
        dem_net = demesne * net_field - hired * p['hire']
        return dict(tithe=tithe, rent=rent_field * Tf, tax=tax, interest=interest, tolls=toll_farm + toll_town,
                    demesne=dem_net), owed, hired, dem_days

    if not solve_tenants and p.get('tenant_fields') is None:
        p['tenant_fields'] = p['tenancy'] * fields
    if solve_tenants:
        lo, hi = 0.0, 5000.0
        for _ in range(80):
            mid = (lo + hi) / 2
            inc = sum(elite_income(mid)[0].values())
            lo, hi = (mid, hi) if inc < elite_req * (1 + p['elite_reserve']) else (lo, mid)
        p['tenant_fields'] = hi
    Tf = p['tenant_fields']
    inc, owed, hired, dem_days = elite_income(Tf)
    elite_income_total = sum(inc.values())
    elite_surplus = elite_income_total - elite_req  # sold to the town if positive
    rent = inc['rent']
    taken = tithe + rent + tax + interest + toll_farm

    disposable = P - farm_need - rot - taken  # what the farm can sell, feast or give
    town_market_need = (town_need - retinue_need) * (1 - p['town_own']) + toll_town
    if solve_sold or p.get('sold') is None:
        want = town_market_need * (1 + p['town_reserve']) - max(0.0, elite_surplus)
        p['sold'] = want / disposable if disposable > 0 else float('inf')
    sold = p['sold'] * max(0.0, disposable)
    feast = max(0.0, disposable) - sold
    gifts = p['help_gw'] * farm_hh  # help between farm households: inside the class (already in 'eaten'), nets out
    town_supply = sold + max(0.0, elite_surplus)

    # goodwill (per farm household), steady stock = inflow / decay rate
    k = math.log(2) / p['gw_half']
    gw_in_help = p['help_gw']
    gw_in_feast = p['feast_credit'] * feast / farm_hh
    gw_stock = (gw_in_help + gw_in_feast) / k
    feast_needed_alone = p['gw_target'] * k / p['feast_credit'] * farm_hh  # if feasts were the only source

    # a full tenant household (every field rented), median and bad year, kept over need
    hh_need = farm_need / farm_hh
    hh_P = P / farm_hh
    hh_take = (tithe + tax + interest + toll_farm) / farm_hh + rent_field * p['fields_hh']
    tenant_kept = (hh_P - hh_take - p['rot'] * hh_P) / hh_need
    bad_loss = (1 - p['bad_year']) * grain_net / farm_hh
    tenant_kept_bad = (hh_P - bad_loss - hh_take + (1 - p['bad_year']) * p['rent'] * gross_field * p['fields_hh']
                       - p['rot'] * hh_P) / hh_need  # rent falls with the harvest; tithe on gross falls little (ignored)

    # labour (farm adults 15-59)
    W = F['workers']
    seasons = ('spring', 'summer', 'autumn', 'winter')
    lab = {}
    for s in seasons:
        idle = p['idle'][s]
        if s != 'winter':
            walk = p['walk_share'] * (1 - PAR['idle'][s])
            idle = idle - (p['walk_share'] / PAR['walk_share'] - 1) * walk  # more walking, less idle
        if s == 'autumn':
            idle -= (p['fields_hh'] / PAR['fields_hh'] - 1) * p['field_share_autumn']
        avail = W * 12
        free = idle * avail
        dem = dem_days * p['demesne_season'][s]
        lab[s] = dict(adult_days=avail, idle=free, demesne=dem, buffer=p['peak_buffer'] * avail if s == 'autumn' else 0.0,
                      left=free - dem - (p['peak_buffer'] * avail if s == 'autumn' else 0.0))
    craft_workers = T['workers'] * p['craft_share']
    winter_replace_workers = lab['winter']['left'] / p['craft_days']
    winter_replace_people = winter_replace_workers / (T['workers'] / T['stock'])

    # land
    cap = p['villages'] * p['reach_fields']
    fields_used = fields + demesne
    meadows = farm_hh * p['meadows_hh']
    tiles_used = fields_used + meadows + farm_hh + p['elite_hh'] + T['stock'] / 5  # one tile a field, meadow, house (I)

    food = dict(P=P, seed=seed, gross=gross, grain_gross=grain_gross, grain_net=grain_net, other=other,
                farm_eaten=farm_need, rot=rot, tithe=tithe, rent=rent, tax=tax, interest=interest, toll_farm=toll_farm,
                taken=taken, sold=sold, feast=feast, disposable=disposable, gifts_internal=gifts,
                town_need=town_need, town_own=(town_need - retinue_need) * p['town_own'], town_bought=sold,
                town_from_elite_surplus=max(0.0, elite_surplus), retinue_fed_by_elite=retinue_need, toll_town=toll_town,
                elite_own=elite_own, elite_hospitality=elite_own * p['hospitality'], demesne_net=inc['demesne'],
                net_field=net_field, gross_field=gross_field, R_effective=P / farm_need)
    elite = dict(households=p['elite_hh'], requirement=elite_req, per_household=elite_req / p['elite_hh'],
                 own=elite_own, hospitality=elite_own * p['hospitality'], retinue=retinue, retinue_need=retinue_need,
                 income=inc, income_total=elite_income_total, surplus=elite_surplus, tenant_fields=Tf,
                 tenant_fields_per_hh=Tf / p['elite_hh'], tenancy_share=Tf / fields, rent_field=rent_field,
                 demesne_fields=demesne, owed_days=owed, hired_days=hired, demesne_days=dem_days,
                 rent_share_of_output=rent / P, tithe_share_of_output=tithe / P, taken_share_of_output=taken / P)
    margins = dict(
        town=(town_supply - town_market_need) / town_market_need,           # who goes short: the town
        farm=disposable / farm_need,                                           # the average farm below need
        tenant=tenant_kept - 1.0,                                              # a full tenant, median year
        tenant_bad=tenant_kept_bad - 1.0,                                      # a full tenant, 1-in-4 bad year (soft)
        elite=elite_surplus / elite_req,                                       # the elite cannot keep its retinue
        goodwill_feast=gw_in_feast / k / p['gw_target'],                      # share of today's stock feasts would hold (soft)
        labour_peak=lab['autumn']['left'] / lab['autumn']['adult_days'],      # no free hands at harvest
        land=1 - fields_used / cap,                                           # fields beyond a day's walk
    )
    return dict(p=p, food=food, elite=elite, goodwill=dict(stock=gw_stock, help_in=gw_in_help, feast_in=gw_in_feast,
                decay=k * gw_stock, feast_needed_if_only_source=feast_needed_alone,
                feast_needed_share_of_P=feast_needed_alone / P,
                feast_needed_share_of_surplus=feast_needed_alone / (P - farm_need)),
                labour=dict(seasons=lab, farm_workers=W, craft_workers=craft_workers,
                            winter_replace_workers=winter_replace_workers, winter_replace_people=winter_replace_people),
                land=dict(farm_hh=farm_hh, fields=fields, demesne=demesne, fields_used=fields_used, reach_cap=cap,
                          meadows=meadows, tiles_used=tiles_used, tiles_share=tiles_used / p['land_tiles'],
                          elite_owned_share=(Tf + demesne) / fields_used, tenancy_share=Tf / fields),
                tenant=dict(kept=tenant_kept, kept_bad=tenant_kept_bad, take_share=hh_take / hh_P),
                margins=margins)


HARD = ('town', 'farm', 'tenant', 'elite', 'labour_peak', 'land')  # tenant_bad and goodwill_feast are reported, not breaks
