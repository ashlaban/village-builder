// @sys sim/roles: the roles and their work (VB-419, from sim/rules): each role's ranks of the types of work, a child's working rate,
// and how hands are matched to tasks (MATCH)
VB['sim/roles'] = (() => {
  // @tunable ROLES: roles and work: each role ranks types of work from 0 to 10 (`work`), with exceptions for single job kinds (`except`); sim/kinds gives
  // every kind its type and fills in `prio`, each role's rank of every kind. Herding (VB-136; Kim, 31 Oct): child 8, daughter 6, son 5,
  // retired 4, farmhand 3, farmer 2, and none for the mistress and the maid. Hunting (VB-139) is foraging for the men alone: none for the
  // women, the retired and children. A village duty (VB-058: the green and well; Kim, 30 Oct): farmhand and son 6, farmer 5, mistress, maid
  // and daughter 3, below the farm's own work; none for the retired and children. A village work day (VB-120; Kim, 10 Nov): 8 for every
  // adult whatever the role (WORKDAY.prio), none for children. Jobs carry an owner that decides who may take them ----
  const ROLES = {
    farmer: {
      title: 'Farmer',
      sv: 'bonde',
      work: {
        workday: 8,
        duty: 5,
        tilling: 10,
        tending: 10,
        harvest: 8,
        threshing: 8,
        wood: 7,
        upkeep: 6,
        household: 2,
        husbandry: 3,
        foraging: 3,
        herding: 2,
      },
      except: { reap: 9, cook: 1, slaughter: 8, grind: 1 },
    },
    wife: {
      title: 'Mistress of the house',
      sv: 'husfru',
      work: {
        workday: 8,
        duty: 3,
        tilling: 2,
        tending: 5,
        harvest: 6,
        threshing: 2,
        wood: 2,
        upkeep: 2,
        household: 9,
        husbandry: 9,
        foraging: 4,
      },
      except: { reap: 7, cook: 10, mow: 4, slaughter: 2, milk: 10, fish: 2, hunt: 0, grind: 7 },
    },
    farmhand: {
      title: 'Farmhand',
      sv: 'dräng',
      work: {
        workday: 8,
        duty: 6,
        tilling: 9,
        tending: 6,
        harvest: 8,
        threshing: 8,
        wood: 9,
        upkeep: 7,
        household: 3,
        husbandry: 4,
        foraging: 6,
        herding: 3,
      },
      except: { cook: 0, slaughter: 8, gather: 3, grind: 1 },
    },
    maid: {
      title: 'Maid',
      sv: 'piga',
      work: {
        workday: 8,
        duty: 3,
        tilling: 1,
        tending: 4,
        harvest: 6,
        threshing: 2,
        wood: 2,
        upkeep: 1,
        household: 10,
        husbandry: 10,
        foraging: 5,
      },
      except: { reap: 7, cook: 8, mow: 4, slaughter: 2, fish: 2, hunt: 0, grind: 7 },
    },
    son: {
      title: 'Son of the house',
      sv: 'son',
      work: {
        workday: 8,
        duty: 6,
        tilling: 9,
        tending: 6,
        harvest: 8,
        threshing: 8,
        wood: 9,
        upkeep: 7,
        household: 3,
        husbandry: 3,
        foraging: 7,
        herding: 5,
      },
      except: { cook: 0, slaughter: 7, gather: 3, grind: 1 },
    },
    daughter: {
      title: 'Daughter of the house',
      sv: 'dotter',
      work: {
        workday: 8,
        duty: 3,
        tilling: 1,
        tending: 4,
        harvest: 6,
        threshing: 2,
        wood: 2,
        upkeep: 1,
        household: 10,
        husbandry: 9,
        foraging: 6,
        herding: 6,
      },
      except: { reap: 7, cook: 8, mow: 4, slaughter: 2, fish: 2, hunt: 0, grind: 6 },
    },
    retired: {
      title: 'Retired',
      sv: 'undantag',
      work: { workday: 8, tending: 2, threshing: 2, upkeep: 2, household: 3, husbandry: 3, foraging: 3, herding: 4 },
      except: { cook: 4, slaughter: 2, hunt: 0, grind: 3 },
    },
    child: {
      title: 'Child',
      sv: 'barn',
      work: { harvest: 3, foraging: 5, herding: 8 },
      except: { water: 6, weed: 5, haul: 4, rake: 4, hay: 4, mow: 0, hunt: 0 },
    },
  };
  // @tunable STAND: the roles a holder stands in for (VB-1542; Kim, 23 Nov: a lone holder gains the absent roles' ranks; design.md, A
  // holder alone). Each key is a role of the household's head pair, with the roles that fill its place: the mistress's is filled by a
  // mistress, a maid or a daughter of the house (each of whom ranks the household's work as she does or above). A role is absent when
  // none of the members the head allots the day to (living, 7 or older, at home, not on a day owed elsewhere nor commanded; ill or
  // nursing still count) holds a role that fills it, the holder apart; the holder then ranks each kind of work at the higher of its own
  // rank and the absent role's (sim/kinds `ranks`; read in sim/jobs prioOf). Only the holder stands in: a mistress left alone at home
  // keeps her own ranks. The holder is always `farmer` (sim/heirs refreshRoles), so the farmer's place is never absent.
  const STAND = { wife: ['wife', 'maid', 'daughter'] };
  const STAND_KEYS = Object.keys(STAND);
  // The absent roles among pawns `ps` (those the head allots the day to), the holder apart: a mask, bit i for STAND_KEYS[i]. One pass
  // over the household's members, made once an allotment by its caller.
  function absentMask(holder, ps) {
    let m = (1 << STAND_KEYS.length) - 1;
    for (const p of ps)
      if (p.id !== holder)
        for (let i = 0; i < STAND_KEYS.length; i++) if (STAND[STAND_KEYS[i]].includes(p.role)) m &= ~(1 << i);
    return m;
  }
  // @tunable CHILD: a child's working rate, by its age
  // Children of 7 to 13 work at a reduced rate: 0.3 at 7, rising 0.1 a year to 0.9 at 13; under 7 they take no jobs.
  const CHILD = { from: 7, base: 0.3, perYear: 0.1 };
  const workRate = (role, age) => (role === 'child' ? Math.min(1, CHILD.base + CHILD.perYear * (age - CHILD.from)) : 1);
  // @tunable MATCH: the fit of a pawn for a task, the head's day, help between households
  // The fit of a pawn for a job (jobs.js): its role's priority for the kind times the job's urgency, less distanceWeight for each step
  // from home; a good fit (priority above poorFit) never falls under `floor`. The head allots a household's day by it (VB-466); a
  // further hand on a job counts for join of the one before (VB-102), so a free job comes first. When the day is allotted anew, a pawn
  // at work leaves its job for one whose fit is above switchRatio × its own job's + switchMargin (VB-107).
  // urgency: a job's weight in a bid, by kind (see the kinds in sim/kinds).
  const MATCH = {
    poorFit: 2,
    // The head's day (VB-466): a task is given hands until they finish it within `horizon` working days, and a member is given tasks
    // up to its working hours of that time; what it may do besides follows in its list. The day is allotted at the hour before work and
    // again at `afternoon` (VB-1543; Kim, 23 November), the hour the afternoon's urgencies change: water's rises above cooking's, the
    // cook's window opens (sim/chores); so that a task that has become more pressing reaches the lists made in the morning. `evening`
    // (VB-1544): the hour after the end of work past which no task is begun, even of a kind that may be begun in the evening (the
    // water, sim/kinds `evening`): 20:00, so that a half-hour fetch is home before the dark at every season (sim/rules dark: 21:00 at
    // its earliest, midwinter).
    day: { horizon: 0.5, afternoon: 14, evening: 20 },
    floor: 0.1, // a good fit (priority above poorFit) always bids at least the floor
    distanceWeight: 0.15,
    join: 0.8,
    switchRatio: 1.5,
    switchMargin: 1,
    // Help between households (VB-106, VB-470; design.md, Help between households): a head short of hands asks (sim/hands); the head
    // asked lends its adults of `minAge` or more for work of the `kinds` when `factor`, plus `kin` for near kin of the asker, plus its
    // opinion of the asker, is above nothing. The tie of a helper with each adult helped rises by `tie` for each `tieHours` it gave.
    help: {
      minAge: 14,
      kinds: ['plow', 'sow', 'weed', 'reap', 'haul', 'thresh', 'clear', 'break', 'mend'],
      factor: 0.5,
      kin: 1,
      tie: 0.2,
      tieHours: 4,
    },
    urgency: {
      field: 1,
      fieldPerDay: 8, // plow and sow: 1 + sday / 8
      reap: 1.3,
      reapFrostPerDay: 5,
      haul: 1.1, // reap: 1.3; both, in autumn, + the days gone of a season ending at the year's frost / 5 (sim/fieldwork frostNear)
      woodLow: 8,
      woodLowUrgency: 2.2,
      woodColdUrgency: 3, // VB-327: a cold household's wood comes before its cooking (cookEvening 2.2)
      woodSummer: 0.5, // wood: 2.2 under 8 in store, else its shortfall of the goal, + 0.5 in autumn
      waterMorning: 1.4,
      waterMorningHour: 10,
      water: 1,
      waterLate: 3.3, // VB-331: from the afternoon (day.afternoon), 1.5 times cookEvening: the water comes before the cooking
      cookEvening: 2.2,
      cookEveningHour: 15,
      cook: 0.6,
      brew: 0.5,
      mendPerCond: 2,
      other: 1,
      rake: 0.8,
      mow: 1,
      mowPerDay: 12, // mow: 1 + days into the haymaking window / 12 (sim/meadows)
      fodder: 1.5,
      slaughter: 1.2,
      shear: 1.4, // shearing at the fold (VB-679): the flock is kept in until it is done
      slaughterNow: 3,
      salt: 1.6, // the byre (sim/byre): slaughterNow when hay runs short
      milk: 1.5,
      milkLate: 0.8,
      milkLateHour: 10, // milking (VB-135): in the morning, less pressing after milkLateHour
      manure: 1.7, // carting manure (VB-137): before the hoeing, as the winter's dung went out before the plough
      manureSurplus: 0.5, // dung to spare (VB-718): after the hoeing and the sowing, so that it never makes a household sow late
      repair: 0.5, // the house's upkeep (VB-306): below the fields' work and the fence's mending
      herd: 1.5, // herding (VB-136): the animals' daily care, as milking and the byre
      fishCalm: 0.2,
      fishLean: 2,
      fishCalmDays: 24, // fishing (VB-117): 0.2 while spare food covers 24 days of need, rising in a line to 2 at none
      // A household out of food (VB-1546; Kim, 24 Nov: fix the inversion): under needDays of spare food the work that brings food in
      // (the kinds that read spare food: fishing, gathering, hunting) rises in a line to `need` at none, above the work whose payoff is
      // months away: at none the holder's foraging 3 x 8 = 24 is above his ploughing and sowing at their most pressing (10 x 2.4) and a
      // low woodpile (7 x 2.2); the water late (a mistress's 9 x 3.3) stays first. Over a few days only: one trip's catch lifts a
      // household of one past it, so the day's other work still gets its hours.
      need: 8,
      needDays: 3,
    },
  };
  return { ROLES, STAND, STAND_KEYS, absentMask, CHILD, workRate, MATCH };
})();
