var VotingProcess = artifacts.require("VotingProcess");
var VotingEntity = artifacts.require("VotingEntity");

module.exports = function (deployer, networkName, accounts) {
  console.log("Deploying from", accounts[0]);
  // deployment steps
  deployer.deploy(VotingProcess);
  deployer.deploy(VotingEntity);
};