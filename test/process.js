var VotingProcess = artifacts.require("VotingProcess")

contract('VotingProcess', function (accounts) {
    it("No process should exist", function () {
        return VotingProcess.deployed().then(function (instance) {
            return instance.getProcessesLength({from:accounts[0]})
        }).then(function (processesLength) {
            assert.equal(processesLength.valueOf(), 0, "processess index should be empty")
        });
    });
});