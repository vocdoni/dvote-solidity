var VotingProcess = artifacts.require("VotingProcess")

contract('VotingProcess', function (accounts) {
    it("Checks no process exists", function () {
        return VotingProcess.deployed().then(function (instance) {
            return instance.getProcessesLength({ from: accounts[0] })
        }).then(function (processesLength) {
            assert.equal(processesLength.valueOf(), 0, "processess index should be empty")
        });
    });

    let organizerAddress = accounts[0]

    input = {
        name: "This is a process name",
        startBlock: 0,
        endBlock: 0,
        censusMerkleRoot: "0xcccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccc",
        voteEncryptionKey: "0xeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeee",
    }

    it("Creates a new process", async () => {
        let instance = await VotingProcess.deployed()
        await instance.createProcess(input.name, input.startBlock, input.endBlock, input.censusMerkleRoot, input.voteEncryptionKey, { from: organizerAddress })
        let processesLength = await instance.getProcessesLength({ from: organizerAddress })
        assert.equal(processesLength.valueOf(), 1, "Only one process exists")
        let processId = await instance.getProcessId(organizerAddress, input.name, { from: organizerAddress })
        let processMetadata = await instance.getProcessMetadata(processId, { from: organizerAddress })

        assert.equal(processMetadata.name, input.name, "The name should match the input")
        assert.equal(processMetadata.startBlock, input.startBlock.valueOf(), "The startBlock should match the input")
        assert.equal(processMetadata.endBlock, input.endBlock.valueOf(), "The endBlock should match the input")
        assert.equal(processMetadata.censusMerkleRoot, input.censusMerkleRoot, "The censusMerkleRoot should match the input")
        assert.equal(processMetadata.voteEncryptionKey, input.voteEncryptionKey, "The voteEncryptionKey should match the input")
    })
});
