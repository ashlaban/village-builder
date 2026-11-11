// @sys sim: the public Sim object, assembled from the sim/* modules
const Sim = (() => {
  const Culture = VB['culture'];
  const { cal, SEASONS, DAY, YEAR, YEAR_DAYS, SEASON_DAYS, ECON, ROLES, WORK, dark, RIVER, byRiver } = VB['sim/rules'];
  const { KINDS } = VB['sim/kinds'];
  const {
    age, birthYear, fullName, spouseOf, childrenOf, siblingsOf, kinship, kinDegree, villageOf, practice, farmPractice, isHolder, holdingOf,
    settlementIdOf, membersOf, voiceOf,
  } = VB['sim/records'];
  const { recordOf, NOTABLE, notable, eventLine, CHRONICLE, chronicle, villageLog, SKIP, skipFrom, skipStop } = VB['sim/notable'];
  const { describe: doing } = VB['sim/agents'], { occasionLabel } = VB['sim/occasions'];
  // What a pawn is doing, for its card: at or on its way to an occasion (VB-126), else as sim/agents tells it.
  const describe = (st, id) => occasionLabel(st, st.agents[id]) || doing(st, id);
  const { explainIdle, idleLine } = VB['sim/jobs'];
  const { seedReserve } = VB['sim/hunger'];
  const { fieldsWanted } = VB['sim/fields'];
  const { plotProgress } = VB['sim/expansion'];
  const { ownerOf, setOwner } = VB['sim/ownership'];
  const { heirRanking, wantsOut, refreshRoles, countDemand } = VB['sim/heirs'];
  const { updateTies, refreshInterests, hooks, prestigeParts } = VB['sim/society'];
  const { save, load } = VB['sim/saves'];
  const { issue: command, inhabit, uninhabit, queue, unqueue, setAuto, wish, answer } = VB['sim/commands'];
  const { actorView, forPawn, successors, succeed } = VB['sim/opportunities'];
  // What a pawn may do here (and at tile `near`), read through its actor view (sim/opportunities).
  const opportunities = (st, id, near = null) => forPawn(st, actorView(st, id), id, near);
  const { compat, standingWord, opinionOf, opinionWord, relationsOf, reasonsOf, goodwillOf } = VB['sim/relations'];
  const { explainAllowance, giftWarning } = VB['sim/exchange'];
  const { kinHouseholds } = VB['sim/help'];
  const { killPawn, holdMeetings, movingRound, retireHolder } = VB['sim/lifecycle'];
  const { seed } = VB['sim/scenarios'];
  const { advance } = VB['sim/clock'];
  const { HERD, SOIL, CLAIMS } = VB['sim/rules'];
  const { herdsOf, dailyHay, winterNeed, stalled, years, describeHerds, herdReport, team, inMilk } = VB['sim/herds'];
  const { withOxen } = VB['sim/agents'];
  const { larderOf } = VB['sim/hunger'];
  const { claimsOn, strength, holdings } = VB['sim/claims'];
  const { knows: knowsDeposit, known: depositKnown } = VB['sim/prospect'];
  const { left: depositLeftNow } = VB['sim/dig']; // VB-344: loads left now, bog iron grown back

  return {
    seed, advance, save, load, recordOf, command, inhabit, uninhabit, queue, unqueue, setAuto, wish, opportunities, successors, succeed, cal, age, birthYear,
      fullName, spouseOf,
      childrenOf, siblingsOf,
      kinship, kinDegree, describe, villageOf,
      SEASONS, DAY,
      YEAR,
      YEAR_DAYS,
    SEASON_DAYS, ECON, ROLES, KINDS, WORK, dark, killPawn, retireHolder, holdMeetings, movingRound, heirRanking, practice, farmPractice, wantsOut, countDemand,
    isHolder, holdingOf, prestigeParts, settlementIdOf, membersOf, voiceOf, hooks, refreshInterests, updateTies, refreshRoles, Culture, ownerOf, setOwner,
      seedReserve, fieldsWanted,
    plotProgress, explainIdle, idleLine, RIVER, byRiver, compat, standingWord, opinionOf, opinionWord, relationsOf, reasonsOf,
    HERD, SOIL, herdsOf, dailyHay, winterNeed, stalled, years, describeHerds, herdReport, larderOf, team, withOxen, inMilk,
    claimsOn, claimStrength: strength, holdings, CLAIMS, knowsDeposit, depositKnown, goodwillOf, explainAllowance,
    depositLeftNow,
    giftWarning, kinHouseholds, NOTABLE, notable, eventLine, CHRONICLE, chronicle, villageLog,
    SKIP, skipFrom, skipStop, answer,
  };
})();
VB['sim'] = Sim;
if (typeof module !== 'undefined') module.exports = Sim;
