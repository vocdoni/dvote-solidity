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
        censusFranchiseProofUrl:"http://vocdoni.io/",       
        voteEncryptionPublicKey: "0xeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeee",
        question: "Blue pill or red pill?",
        votingOptions: ["0x0000000000000000000000000000000000000000000000000000000000000000", "0x1111111111111111111111111111111111111111111111111111111111111111"],
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
            input.censusFranchiseProofUrl,
            input.question,
            input.votingOptions,
            input.voteEncryptionPublicKey,
            { from: organizerAddress })

        let processesLength = await instance.getProcessesLength({ from: organizerAddress })
        assert.equal(processesLength.valueOf(), 1, "Only one process exists")

        let processIdByIndex = await instance.getProcessIdByIndex(0, { from: organizerAddress })

        let processId = await instance.getProcessId(organizerAddress, input.name, { from: organizerAddress })
        assert.equal(processIdByIndex, processId, "The processId should be the same")

        let processesIdByOrganizer = await instance.getProcessesIdByOrganizer(organizerAddress);
        assert.deepEqual(processesIdByOrganizer, [processId]);
    })

    it("Metadata is stored correctly", async () => {
        let instance = await VotingProcess.deployed()
        let processId = await instance.getProcessId(organizerAddress, input.name, { from: organizerAddress })
        let processMetadata = await instance.getProcessMetadata(processId, { from: organizerAddress })

        assert.equal(processMetadata.name, input.name, "The name should match the input")
        assert.equal(processMetadata.startBlock, input.startBlock.valueOf(), "The startBlock should match the input")
        assert.equal(processMetadata.endBlock, input.endBlock.valueOf(), "The endBlock should match the input")
        assert.equal(processMetadata.censusMerkleRoot, input.censusMerkleRoot, "The censusMerkleRoot should match the input")
        assert.equal(processMetadata.censusFranchiseProofUrl, input.censusFranchiseProofUrl, "The censusFranchiseProofUrl should match the input")``
        assert.equal(processMetadata.question, input.question, "The question should match the input")
        assert.equal(processMetadata.votingOptions[0], input.votingOptions[0], "The votingOptions[0] should match the input")
        assert.equal(processMetadata.votingOptions[1], input.votingOptions[1], "The votingOptions[1] should match the input")
        assert.equal(processMetadata.voteEncryptionPublicKey, input.voteEncryptionPublicKey, "The voteEncryptionPublicKey should match the input")
    })

    it("Can't create/override the same process again", async () => {
        let instance = await VotingProcess.deployed()

        let error = null
        try {
            await instance.publishVoteEncryptionPrivateKey(processId, input.voteEncryptionPrivateKey, { from: randomAddress })
            await instance.createProcess(
                input.name,
                input.startBlock,
                input.endBlock,
                input.censusMerkleRoot,
                input.censusFranchiseProofUrl,
                input.question,
                input.votingOptions,
                input.voteEncryptionPublicKey,
                { from: organizerAddress })
        }
        catch (_error) {
            error = _error
        }

        assert.isNotNull(error, "If process already exists should fail")
    })

    it("Register relay", async () => {
        let instance = await VotingProcess.deployed()
        let processId = await instance.getProcessId(organizerAddress, input.name, { from: organizerAddress })

        let relaysLength = await instance.getRelaysLength(processId, { from: randomAddress })
        assert.equal(relaysLength, 0, "No registered relay should exist")

        let relayIsRegistered = await instance.isRelayRegistered(processId, relayAddress, { from: randomAddress })
        assert.isFalse(relayIsRegistered, "This relay should not be registered")

        await instance.registerRelay(processId, relayAddress, { from: organizerAddress })

        relaysLength = await instance.getRelaysLength(processId, { from: randomAddress })
        assert.equal(relaysLength, 1, "One registered relay should exist")

        relayIsRegistered = await instance.isRelayRegistered(processId, relayAddress, { from: randomAddress })
        assert.isTrue(relayIsRegistered, "This relay should be registered")

        let registeredRelayAddress = await instance.getRelayByIndex(processId, 0, { from: randomAddress })
        assert.equal(registeredRelayAddress, relayAddress, "Added votesBatch should match the stored one")
    })

    it("Can't register the same relay again", async () => {
        let instance = await VotingProcess.deployed()
        let processId = await instance.getProcessId(organizerAddress, input.name, { from: organizerAddress })

        try {
            await instance.registerRelay(processId, relayAddress, { from: organizerAddress })
        }
        catch (_error) {
            error = _error
        }

        assert.isNotNull(error, "If relay is registred already, should fail")
    })

    it("Relay adds votesBatch", async () => {
        let instance = await VotingProcess.deployed()
        let processId = await instance.getProcessId(organizerAddress, input.name, { from: organizerAddress })

        let votesBatchLength = await instance.getRelayVotesBatchesLength(processId, relayAddress, { from: randomAddress })
        assert.equal(votesBatchLength, 1, "One votesBatch should exist (signaling the relay is registered)")

        let votesBatch = await instance.getVotesBatch(processId, relayAddress, 0)
        let nullVotesBatch = await instance.getNullVotesBatchValue({ from: randomAddress })
        assert.equal(votesBatch, nullVotesBatch, "The existing votesBatch should be equal to then nullVotesBatch value")

        await instance.addVotesBatch(processId, input.votesBatch1, { from: relayAddress })

        votesBatchLength = await instance.getRelayVotesBatchesLength(processId, relayAddress, { from: randomAddress })
        assert.equal(votesBatchLength, 2, "Two votesBatch should exist")

        let votesBatch1 = await instance.getVotesBatch(processId, relayAddress, 1)
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
        let voteEncryptionPrivateKey = await instance.getVoteEncryptionPrivateKey(processId, { from: organizerAddress })
        assert.equal(voteEncryptionPrivateKey, "", "The voteEncryptionPrivateKey should still be empty")
    })

    it("Organization publishes the voteEncryptionPrivateKey", async () => {
        let instance = await VotingProcess.deployed()
        let processId = await instance.getProcessId(organizerAddress, input.name, { from: organizerAddress })
        await instance.publishVoteEncryptionPrivateKey(processId, input.voteEncryptionPrivateKey, { from: organizerAddress })
        let voteEncryptionPrivateKey = await instance.getVoteEncryptionPrivateKey(processId, { from: organizerAddress })
        assert.equal(voteEncryptionPrivateKey, input.voteEncryptionPrivateKey, "The voteEncryptionPrivateKey should match the input")
    })

    it("Value of nullVotesBatch is the expected", async () => {
        let instance = await VotingProcess.deployed()
        let nullVotesBatch = await instance.getNullVotesBatchValue({ from: randomAddress })
        assert.equal(nullVotesBatch, 0xFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFF, "nullVotesBatch is always 0xFFFFF...")
    })
})

