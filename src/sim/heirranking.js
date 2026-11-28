// @sys sim/heirranking: blood lines, succession customs and competing claims to a farm
VB['sim/heirranking'] = (() => {
  const { childrenOf, spouseOf, holdingOf, practice, villageOf, householdsOfLine, ancestorsOf } = VB['sim/records'];
  // The living of pawn `line`'s blood in the order its customs `cu` give (sex, birth order; under "chosen" those of household `homeId`
  // first): its children and their lines (a dead child's children stand in its place), to four generations; then, unless `nested`, its
  // siblings and their lines and its parents' siblings and theirs. {out, direct}: direct the first part alone. A child born outside
  // marriage (pawn.outside) stands by the custom `outside` (VB-555): as the others, after those born in marriage (before sex and birth
  // order), or not at all, nor its line.
  function bloodLine(st, line, cu, homeId, nested) {
    const after = cu.outside === 'after',
      barred = (id) => cu.outside === 'none' && st.pawns[id].outside === true;
    const sexRank = (p) =>
      cu.heirSex === 'sonsFirst'
        ? p.sex === 'm'
          ? 0
          : 1
        : cu.heirSex === 'daughtersFirst'
          ? p.sex === 'f'
            ? 0
            : 1
          : 0;
    const order = (ids) =>
      [...ids].sort((a, b) => {
        const pa = st.pawns[a],
          pb = st.pawns[b],
          s = after && pa.outside !== pb.outside ? (pa.outside === true ? 1 : -1) : sexRank(pa) - sexRank(pb);
        if (s) return s;
        if (cu.birthOrder === 'youngest') return pb.born - pa.born;
        if (cu.birthOrder === 'chosen') {
          const ha = pa.household === homeId ? 0 : 1,
            hb = pb.household === homeId ? 0 : 1;
          if (ha !== hb) return ha - hb;
        }
        return pa.born - pb.born;
      });
    const out = [],
      seen = new Set();
    const lineOf = (id, depth) => {
      if (depth > 3) return;
      for (const c of order(childrenOf(st, id))) {
        if (seen.has(c)) continue;
        seen.add(c);
        if (barred(c)) continue;
        if (st.pawns[c].died === null) out.push(c);
        lineOf(c, depth + 1); // a dead child's children stand in their place; a living child's line follows them
      }
    };
    lineOf(line, 0);
    const direct = new Set(out);
    seen.add(line);
    let anc = line;
    for (let up = 0; !nested && up < 2; up++) {
      const lp = st.pawns[anc];
      if (lp.father === null && lp.mother === null) break;
      const parent = lp.father !== null ? lp.father : lp.mother;
      for (const s of order(childrenOf(st, parent).filter((q) => q !== anc))) {
        if (seen.has(s)) continue;
        seen.add(s);
        if (barred(s)) continue;
        if (st.pawns[s].died === null) out.push(s);
        lineOf(s, 1);
      }
      anc = parent;
      seen.add(parent);
    }
    return { out, direct };
  }
  // A person's successor (VB-1121): the first living of its line by the inheritance customs of its village (bloodLine, read as
  // heirRanking reads it), whether or not it holds a farm. The widow's right to a farm, a successor's own holding, its refusal or its
  // being passed over for the holding do not unmake it: it is the line's, not the holding's. Under "sons only" a daughter is not of the
  // line. The line reaches as far as a farm of its would: its descendants to four generations, its siblings and theirs, its parents'
  // siblings and theirs; past them it ends, and null is returned.
  // `village` names the customs where the pawn has no household (the played pawn after its death: st.player.left.village).
  function successorOf(st, id, village = null) {
    const p = st.pawns[id];
    if (!p) return null;
    const cu = practice(st, p.household !== null ? villageOf(st, p) : village !== null ? village : 0);
    const { out } = bloodLine(st, id, cu, p.household, false);
    const q = out.find((x) => x !== id && !(cu.heirSex === 'sons' && st.pawns[x].sex === 'f'));
    return q === undefined ? null : q;
  }
  // The place this heir would leave: its own holding, or its home if the spouse holds it.
  function heirsPlace(st, id, deps = null) {
    const own = holdingOf(st, id);
    if (own) return own;
    const sp = spouseOf(st, id);
    if (sp === null) return null;
    if (deps) deps.add(sp);
    const home = st.households[st.pawns[id].household];
    return home && !home.dissolved && home.holder === sp ? home : null;
  }
  VB.counter('heirRank', 'All heirRanking calls, including nested rankings and indirect callers');
  // Who would inherit this farm now, in order, under the practice of its village. The order is whom the holding is offered to, and the
  // passing over is what each would answer (VB-824; design.md, Succession: Handed on, and taken up): `asked`, an array, gets the whole
  // line in the order asked, {id, no (why this one would not take it, or null)}; those with no null, in that order, are the ranking.
  function heirRanking(st, hh, cust = null, nested = false, ownFirstSet = null, deps = null, asked = null) {
    VB.count.heirRank++;
    const f = st.farmsteads[hh.farmstead],
      cu = cust || practice(st, f.village);
    const line = f.line !== undefined && f.line !== null ? f.line : hh.holder;
    const { out, direct } = bloodLine(st, line, cu, hh.id, nested);
    if (deps) {
      deps.add(line);
      deps.add(hh.holder);
    }
    // Each one's answer: no, with why, when the place already held has at least as many fields.
    const no = asked ? new Map() : null,
      nameOf = (o) => st.farmsteads[o.farmstead].name,
      says = (id, why) => (no ? !no.set(id, why(id)) : false);
    const inLine = out.filter((id) => {
      if (deps) deps.add(id);
      return !(cu.heirSex === 'sons' && st.pawns[id].sex === 'f') && id !== hh.holder;
    });
    const ok = inLine.filter((id) => {
      const place = heirsPlace(st, id, deps);
      if (place && place !== hh && st.farmsteads[place.farmstead].fields.length >= f.fields.length)
        return says(
          id,
          () => `${place.holder === id ? 'holds' : 'lives at'} ${nameOf(place)} with at least as many fields`,
        );
      return true;
    });
    const ask = (ids) => {
      if (asked) for (const id of ids) asked.push({ id, no: no.get(id) || null });
    };
    if (nested) return ok.filter((id) => direct.has(id));
    if (!ok.length) {
      ask(inLine);
      return ok; // No competing direct claim can change an empty ranking.
    }
    // a relative who is first in line for their own parents' farm steps behind the others here: farms are not
    // combined while someone else in the family can take this one. Direct heirs of this farm keep their place.
    // Only a farm whose line is a candidate's ancestor, at most four generations up (lineOf), can have the candidate first (VB-224).
    const claims = ownFirstSet
      ? ownFirstSet.filter((e) => e[1] !== hh.id)
      : ownFirstOf(
          st,
          hh,
          [...ancestorsOf(st, ok, 4)].flatMap((id) => {
            if (deps) deps.add(id);
            return householdsOfLine(st, id);
          }),
          deps,
        );
    if (cu.ownHeir === 'keeps') {
      // nobody steps behind; an heir first in another farm's line too takes the farm with more fields (on a tie, their own
      // parents') and drops the other claim, which passes to the next in that line
      const wins = (id, o) => {
        const n = st.farmsteads[st.households[o].farmstead].fields.length,
          p = st.pawns[id];
        return (
          n > f.fields.length ||
          (n === f.fields.length && (p.household === o || [p.father, p.mother].includes(st.households[o].holder)))
        );
      };
      const kept = ok.filter((id) => {
        const won = claims.find((e) => e[0] === id && wins(id, e[1]));
        return won ? says(id, () => `is heir to ${nameOf(st.households[won[1]])}`) : true;
      });
      ask(inLine);
      return kept;
    }
    const ownFirst = new Set(claims.map((e) => e[0]));
    const back = (id) => !direct.has(id) && ownFirst.has(id);
    ask([...inLine.filter((id) => !back(id)), ...inLine.filter(back)]);
    return [...ok.filter((id) => !back(id)), ...ok.filter(back)];
  }
  // [heir, household id] for the first direct heir of each household other than hh (all households when hh is null). Callers that rank many
  // households while nothing changes compute this once and pass it to heirRanking as ownFirstSet. `among`: only these household ids;
  // `deps`: a Set that gets the pawns the rankings read.
  function ownFirstOf(st, hh = null, among = null, deps = null) {
    const out = [];
    for (const id of among || st.liveHouseholds) {
      const o = st.households[id];
      if (o !== hh) {
        const r = heirRanking(st, o, null, true, null, deps);
        if (r.length) out.push([r[0], o.id]);
      }
    }
    return out;
  }
  return { heirsPlace, successorOf, heirRanking, ownFirstOf };
})();
