var VotingProcess = artifacts.require("VotingProcess");

module.exports = function(deployer) {
  // deployment steps
  deployer.deploy(VotingProcess);
};