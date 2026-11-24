// @sys sim/drain: draining a wet field (VB-721): the head's estimate of a ditch's gain against its hours, the making `drain` it begins
// through the verb project, and the ditching, dug by the household's hands at the field
// Design: design.md, Goods and the farming year (Yield over time); docs/review-yields.md, 2.5. A field's wetness is its tile's moisture
// (sim/crops' wetLoss, slice 10's plan VB-190, 5.1); its ditch takes away a share of the loss and silts (sim/soil's DITCH, ditchOf). A
// head, played or not, may ditch a wet field of its own farm; one not played weighs it once a year after the harvest, by its own
// estimate of the gain against the hours (principle 14), as it weighs a new field's site (sim/fieldplans' siteScore). A silted ditch is
// dug again for the share silted, so drainage is kept by work, as tilth is by dung.
VB['sim/drain'] = (() => {
  const { SEASON_DAYS, SPEED } = VB['sim/rules'];
  const { wetLoss } = VB['sim/crops'];
  const { DITCH, ditchOf, ditchDug } = VB['sim/soil'];
  const { siteTerms } = VB['sim/fieldplans'];
  const { hexSteps } = VB['sim/hex'];
  const Projects = VB['sim/projects'];
  const { declare } = VB['sim/makings'];
  const { log, atFarm } = VB['sim/records'];
  const { onField } = VB['sim/fieldwork'];
  // @tunable DRAIN: the head's reckoning of a ditch (VB-721). `again`: a ditch is dug again only once it has silted below this share of
  // its work (at DITCH.years 10, after some five years: "cleared every few years"); `day`: a day's work at the ditch, in hours, for the
  // walks out and back the head counts; `from`: the day of the year from which a head weighs it, after the harvest is in (autumn's middle).
  const DRAIN = { again: 0.6, day: 8, from: 2 * SEASON_DAYS + SEASON_DAYS / 2 };
  // Hours of ditching field fd now: the share of a new ditch's work its ditch has silted.
  const ditchHours = (st, fd) => DITCH.hours * (1 - ditchOf(st, fd));
  // The head's estimate for field fd of farm f (principle 14): rations a year the ditch would win back, over the DITCH.years the head
  // reckons it lasts, for each hour it costs (its digging, and the walks out and back a day's work), in the unit of siteScore (rations for
  // an hour). The crop is the reference crop (barley) on the field's fertility and soil; the head knows its ground's wetness. Allocates
  // nothing.
  function drainScore(st, f, fd, k) {
    const loss = wetLoss(st.w, fd.tile),
      d = ditchOf(st, fd);
    if (loss <= 0) return 0;
    const gain = k.grain * fd.fert * fd.soil * loss * DITCH.share * (1 - d) * DITCH.years,
      hours = ditchHours(st, fd);
    return gain / (hours + (hours / DRAIN.day) * ((2 * hexSteps(st.w, f.house, fd.tile)) / SPEED));
  }
  // The bar a ditch must clear: what an hour of the reference crop's own work gives on a dry field (rations for an hour), so a head
  // ditches when the hours win back more than tilling them would.
  const bar = (k) => (k.grain * k.start) / k.work;
  // Why field `id` of farm f may not be ditched now, or null: the farm's, on wet ground, its ditch silted below DRAIN.again.
  function fieldWhy(st, f, id) {
    const fd = f.fields.find((x) => x.id === id);
    if (!fd) return `${f.name} has no field ${id}`;
    if (wetLoss(st.w, fd.tile) <= 0) return 'the field is not wet';
    return ditchOf(st, fd) >= DRAIN.again ? 'its ditches are still sound' : null;
  }
  // The field of farm f the head would ditch: the best score above the bar, or null.
  function bestField(st, f) {
    const k = siteTerms(),
      floor = bar(k);
    let best = null,
      bs = floor;
    for (const fd of f.fields) {
      VB.count.drainAsk++;
      if (wetLoss(st.w, fd.tile) <= 0 || ditchOf(st, fd) >= DRAIN.again) continue;
      const s = drainScore(st, f, fd, k);
      if (s > bs) {
        bs = s;
        best = fd;
      }
    }
    return best;
  }
  // Ditching a field, a making the head begins through the verb project (sim/plans; args {field}: the field's id): a large project, one
  // at a time beside the household's others (a field, a meadow, a barn), on its own farm's wet field.
  declare('drain', {
    why: (st, hh, f, args) => {
      const p = Projects.ownOf(st, hh.id);
      if (p) return `household ${hh.id} has a ${p.what} under way`;
      return fieldWhy(st, f, args && args.field);
    },
    begin: (st, hh, f, args) => {
      const fd = f.fields.find((x) => x.id === args.field);
      return { field: fd.id, steps: [{ kind: 'ditch', place: fd.tile, hours: ditchHours(st, fd) }] };
    },
    look: {
      from: DRAIN.from,
      want: (st, hh, f) => {
        if (Projects.ownOf(st, hh.id)) return null;
        const fd = bestField(st, f);
        return fd ? { field: fd.id } : null;
      },
    },
  });
  // The ditches dug: the field's ditch is new; the plan is finished (sim/plans).
  function dug(st, j, hh, plan) {
    const f = st.farmsteads[hh.farmstead],
      fd = f && f.fields.find((x) => x.id === plan.field);
    if (!fd) return;
    ditchDug(st, fd);
    st.farmDirty.add(f.id);
    log(st, `${f.name} has ditched a wet field.`, { kind: 'drained', ...atFarm(f) });
  }
  // ---- the job kind (sim/kinds registers it; its fields are described there) ----
  const KINDS = {
    ditch: {
      verb: 'Ditching a wet field',
      go: 'Going to ditch a field',
      name: 'Ditch a wet field',
      at: ['field'],
      needs: [],
      gives: ['field'],
      label: 'Ditch',
      anim: 'hoe',
      hours: DITCH.hours,
      hands: Infinity,
      type: 'tilling',
      field: true,
      project: true,
      spot: onField,
      done: (st, j, hh) => Projects.stepEnds(st, j, hh, dug),
    },
  };
  return { DRAIN, KINDS, drainScore, bestField, fieldWhy, ditchHours };
})();
