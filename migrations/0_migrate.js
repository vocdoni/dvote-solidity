var VotingProcess = artifacts.require("VotingProcess");
var VotingEntity = artifacts.require("VotingEntity");

module.exports = function(deployer) {
  // deployment steps
  console.log(deployer.deploy(VotingProcess));
  console.log(deployer.deploy(VotingEntity));
};