//TODO missing tests to garantee that transaction are done at the correct blocks
//(check startBlock and endBlock), not implementing yet for ease of testing.

var VotingProcess = artifacts.require("VotingProcess")
contract('VotingProcess', function (accounts) {

    let organizerAddress = accounts[0]
    let randomAddress = accounts[1]
    let relayAddress = accounts[2]

    it("Checks no process exists", async () => {
        let instance = await VotingProcess.deployed()
        let processesLength = await instance.getProcessesLength({ from: accounts[0] })
        assert.equal(processesLength.valueOf(), 0, "processess index should be empty")
    });

    input = {
        name: "This is a process name",
        startBlock: 0,
        endBlock: 1,
        censusMerkleRoot: "0xcccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccc",
        voteEncryptionPublicKey: "0xeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeee",
        voteEncryptionPrivateKey: "0xdddddddddddddddddddddddddddddddddddddddddddddddddddddddddddddddd",
        votesBatch1: "0x1111111111111111111111111111111111111111111111111111111111111111",
    }

    it("Creates a new process", async () => {
        let instance = await VotingProcess.deployed()
        await instance.createProcess(
            input.name,
            input.startBlock,
            input.endBlock,
            input.censusMerkleRoot,
            input.voteEncryptionPublicKey,
            { from: organizerAddress })

        let processesLength = await instance.getProcessesLength({ from: organizerAddress })
        assert.equal(processesLength.valueOf(), 1, "Only one process exists")

        let processIdByIndex = await instance.getProcessIdByIndex(0, { from: organizerAddress })

        let processId = await instance.getProcessId(organizerAddress, input.name, { from: organizerAddress })
        assert.equal(processIdByIndex, processId, "The processId should be the same")
    })

    it("Metadata is stored correctly", async () => {
        let instance = await VotingProcess.deployed()
        let processId = await instance.getProcessId(organizerAddress, input.name, { from: organizerAddress })
        let processMetadata = await instance.getProcessMetadata(processId, { from: organizerAddress })

        assert.equal(processMetadata.name, input.name, "The name should match the input")
        assert.equal(processMetadata.startBlock, input.startBlock.valueOf(), "The startBlock should match the input")
        assert.equal(processMetadata.endBlock, input.endBlock.valueOf(), "The endBlock should match the input")
        assert.equal(processMetadata.censusMerkleRoot, input.censusMerkleRoot, "The censusMerkleRoot should match the input")
        assert.equal(processMetadata.voteEncryptionPublicKey, input.voteEncryptionPublicKey, "The voteEncryptionPublicKey should match the input")

        assert.equal(processMetadata.voteEncryptionPrivateKey, "", "The voteEncryptionPrivateKey should empty until the process is finished")
    })

    it("Relay adds votesBatch", async () => {
        let instance = await VotingProcess.deployed()
        let processId = await instance.getProcessId(organizerAddress, input.name, { from: organizerAddress })

        let votesBatchLength = await instance.getRelayVotesBatchesLength(processId, relayAddress, { from: randomAddress })
        assert.equal(votesBatchLength, 0, "No votesBatch should exist")

        await instance.addVotesBatch(processId, input.votesBatch1, { from: relayAddress })

        votesBatchLength = await instance.getRelayVotesBatchesLength(processId, relayAddress, { from: randomAddress })
        assert.equal(votesBatchLength, 1, "One votesBatch should exist")

        let votesBatch1 = await instance.getVotesBatch(processId, relayAddress, 0)
        assert.equal(votesBatch1, input.votesBatch1, "Added votesBatch should match the stored one")
    })

    it("Only Organization can publish the voteEncryptionPrivateKey", async () => {
        let instance = await VotingProcess.deployed()
        let processId = await instance.getProcessId(organizerAddress, input.name, { from: organizerAddress })

        let error = null
        try {
            await instance.publishVoteEncryptionPrivateKey(processId, input.voteEncryptionPrivateKey, { from: randomAddress })
        }
        catch (_error) {
            error = _error
        }

        assert.isNotNull(error, "If msg.sender is no organizer should revert")
        let processMetadata = await instance.getProcessMetadata(processId, { from: organizerAddress })
        assert.equal(processMetadata.voteEncryptionPrivateKey, "", "The voteEncryptionPrivateKey should still be empty")
    })

    it("Organization publishes the voteEncryptionPrivateKey", async () => {
        let instance = await VotingProcess.deployed()
        let processId = await instance.getProcessId(organizerAddress, input.name, { from: organizerAddress })
        await instance.publishVoteEncryptionPrivateKey(processId, input.voteEncryptionPrivateKey, { from: organizerAddress })
        let processMetadata = await instance.getProcessMetadata(processId, { from: organizerAddress })
        assert.equal(processMetadata.voteEncryptionPrivateKey, input.voteEncryptionPrivateKey, "The voteEncryptionPrivateKey should match the input")
    })
})