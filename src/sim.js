// @sys sim: the public Sim object, assembled from the sim/* modules
const Sim = (() => {
  const Culture = VB['culture'];
  const { cal, SEASONS, DAY, YEAR, YEAR_DAYS, SEASON_DAYS, ECON, ROLES, KINDS, WORK } = VB['sim/rules'];
  const {
    age, birthYear, fullName, spouseOf, childrenOf, siblingsOf, kinship, villageOf, practice, farmPractice, isHolder, holdingOf, settlementIdOf,
  } = VB['sim/records'];
  const { describe } = VB['sim/agents'];
  const { ownerOf, setOwner } = VB['sim/ownership'];
  const { heirRanking, wantsOut, refreshRoles } = VB['sim/heirs'];
  const { updateTies, refreshInterests } = VB['sim/society'];
  const { killPawn, holdMeetings, movingRound, retireHolder } = VB['sim/lifecycle'];
  const { seed } = VB['sim/scenarios'];
  const { advance } = VB['sim/clock'];

  return {
    seed, advance, cal, age, birthYear, fullName, spouseOf, childrenOf, siblingsOf, kinship, describe, villageOf, SEASONS, DAY, YEAR, YEAR_DAYS,
    SEASON_DAYS, ECON, ROLES, KINDS, WORK, killPawn, retireHolder, holdMeetings, movingRound, heirRanking, practice, farmPractice, wantsOut,
    isHolder, holdingOf, settlementIdOf, refreshInterests, updateTies, refreshRoles, Culture, ownerOf, setOwner,
  };
})();
VB['sim'] = Sim;
if (typeof module !== 'undefined') module.exports = Sim;
