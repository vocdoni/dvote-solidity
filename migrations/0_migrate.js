var VotingProcess = artifacts.require("VotingProcess");
var VotingEntity = artifacts.require("VotingEntity");

module.exports = function(deployer) {
  // deployment steps
  deployer.deploy(VotingProcess);
  deployer.deploy(VotingEntity);
};