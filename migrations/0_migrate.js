var VotingProcess = artifacts.require("VotingProcess");
var EntityResolver = artifacts.require("EntityResolver");

module.exports = function (deployer, networkName, accounts) {
  console.log("Deploying from", accounts[0]);
  // deployment steps
  deployer.deploy(VotingProcess);
  deployer.deploy(EntityResolver);
};