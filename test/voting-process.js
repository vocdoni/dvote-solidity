const assert = require("assert")
const { getWeb3,
    increaseTimestamp,
    deployVotingProcess,
    setProcessStatus,
    addOracle,
    addValidator,
    removeOracle,
    removeValidator,
    publishResults
} = require("../lib/util")
const { ProcessEnvelopeType, ProcessMode, ProcessStatus } = require("..")

const web3 = getWeb3()

let accounts
let instance
let chainId

let entityAddress, randomAddress1, randomAddress2

const metadata = "ipfs://abcdef...,https://host/file!012345678"
const censusMerkleRoot = "0x1234"
const censusMerkleTree = "ipfs://12345...,https://host/file!23456789"
// const voteEncryptionPrivateKey = "0x1234"
const startBlock = 1234
const numberOfBlocks = 200

describe('VotingProcess', function () {

    beforeEach(async () => {
        accounts = await web3.eth.getAccounts()

        deployAddress = accounts[0]
        entityAddress = accounts[1]
        randomAddress1 = accounts[2]
        randomAddress2 = accounts[3]
        authorizedOracle1 = accounts[4]
        authorizedOracle2 = accounts[5]

        genesis = "0x1234567890123456789012345678901234567890123123123"
        chainId = 1

        instance = await deployVotingProcess(deployAddress, chainId)
    })


    it("should deploy the contract", async () => {
        const localInstance = await deployVotingProcess(deployAddress, chainId)

        assert.ok(localInstance)
        assert.ok(localInstance.options)
        assert.ok(localInstance.options.address.match(/^0x[0-9a-fA-F]{40}$/))
    })

    it("should compute a processId from the entity address and the process index", async () => {
        assert(instance.methods.getProcessId)
        assert(instance.methods.getProcessId.call)

        const proc1 = await instance.methods.getProcessId(accounts[0], 0).call()
        const proc2 = await instance.methods.getProcessId(accounts[0], 0).call()
        const proc3 = await instance.methods.getProcessId(accounts[0], 1).call()
        const proc4 = await instance.methods.getProcessId(accounts[0], 1).call()
        const proc5 = await instance.methods.getProcessId(accounts[0], 2).call()
        const proc6 = await instance.methods.getProcessId(accounts[0], 3).call()
        const proc7 = await instance.methods.getProcessId(accounts[1], 0).call()
        const proc8 = await instance.methods.getProcessId(accounts[1], 1).call()

        assert.equal(proc1, proc2)
        assert.equal(proc3, proc4)

        assert.notEqual(proc1, proc3)
        assert.notEqual(proc1, proc5)
        assert.notEqual(proc1, proc6)

        assert.notEqual(proc3, proc5)
        assert.notEqual(proc3, proc6)

        assert.notEqual(proc5, proc6)

        assert.notEqual(proc7, proc1)
        assert.notEqual(proc8, proc3)
    })

    it("should compute the next processId", async () => {
        assert(instance.methods.getNextProcessId)
        assert(instance.methods.getNextProcessId.call)

        // The entity has 0 processes at the moment
        // So the next process index is 0
        const processId1Expected = await instance.methods.getProcessId(entityAddress, 0).call()
        const processId1Actual = await instance.methods.getNextProcessId(entityAddress).call()

        assert.equal(processId1Expected, processId1Actual)

        const creationResult = await instance.methods.create(ProcessEnvelopeType.REALTIME_POLL, ProcessMode.SCHEDULED_SINGLE_ENVELOPE, metadata, censusMerkleRoot, censusMerkleTree, startBlock, numberOfBlocks).send({
            from: entityAddress,
            nonce: await web3.eth.getTransactionCount(entityAddress)
        })

        assert(creationResult.events.ProcessCreated)
        assert.equal(creationResult.events.ProcessCreated.returnValues.processId, processId1Expected)

        // The entity has 1 process now
        // So the next process index is 1
        const processId2Expected = await instance.methods.getProcessId(entityAddress, 1).call()
        const processId2Actual = await instance.methods.getNextProcessId(entityAddress).call()

        assert.notEqual(processId1Actual, processId2Actual)
        assert.equal(processId2Expected, processId2Actual)
    })

    describe("should set genesis", () => {

        it("only contract creator", async () => {
            try {
                await instance.methods.setGenesis(
                    genesis,
                )
                    .send({
                        from: randomAddress1,
                        nonce: await web3.eth.getTransactionCount(randomAddress1)
                    })
                assert.fail("The transaction should have thrown an error but didn't")
            }
            catch (err) {
                assert(err.message.match(/revert/), "The transaction threw an unexpected error:\n" + err.message)
            }
        })

        it("should persist", async () => {
            await instance.methods.setGenesis(genesis)
                .send({
                    from: deployAddress,
                    nonce: await web3.eth.getTransactionCount(deployAddress)
                })

            let currentGenesis = await instance.methods.getGenesis().call()
            assert.equal(currentGenesis, genesis, "Gensis should match")

            // Another genesis value
            await instance.methods.setGenesis("1234")
                .send({
                    from: deployAddress,
                    nonce: await web3.eth.getTransactionCount(deployAddress)
                })

            currentGenesis = await instance.methods.getGenesis().call()
            assert.equal(currentGenesis, "1234", "Gensis should match")
        })

        it("should emit an event", async () => {
            let result = await instance.methods.setGenesis(genesis)
                .send({
                    from: deployAddress,
                    nonce: await web3.eth.getTransactionCount(deployAddress)
                })

            assert.ok(result)
            assert.ok(result.events)
            assert.ok(result.events.GenesisChanged)
            assert.ok(result.events.GenesisChanged.returnValues)
            assert.equal(result.events.GenesisChanged.event, "GenesisChanged")
            assert.equal(result.events.GenesisChanged.returnValues.genesis, genesis)
        })
    })

    describe("should set chainId", () => {

        it("only contract creator", async () => {
            try {
                await instance.methods.setChainId(
                    chainId,
                )
                    .send({
                        from: randomAddress1,
                        nonce: await web3.eth.getTransactionCount(randomAddress1)
                    })
                assert.fail("The transaction should have thrown an error but didn't")
            }
            catch (err) {
                assert(err.message.match(/revert/), "The transaction threw an unexpected error:\n" + err.message)
            }
        })

        it("should persist", async () => {
            const chainValue = 200
            let result = await instance.methods.setChainId(chainValue)
                .send({
                    from: deployAddress,
                    nonce: await web3.eth.getTransactionCount(deployAddress)
                })
            assert.ok(result.transactionHash)

            await new Promise(resolve => setTimeout(resolve, 1500))

            let currentChainId = await instance.methods.getChainId().call()
            assert.equal(currentChainId, chainValue, "ChainId should match")
        })

        it("should fail if duplicated", async () => {
            try {
                // same that it already is
                await instance.methods.setChainId(chainId)
                    .send({
                        from: deployAddress,
                        nonce: await web3.eth.getTransactionCount(deployAddress)
                    })

                await new Promise(resolve => setTimeout(resolve, 2500))

                assert.fail("The transaction should have thrown an error but didn't")
            }
            catch (err) {
                assert(err.message.match(/revert/), "The transaction threw an unexpected error:\n" + err.message)
            }
        })

        it("should emit an event", async () => {
            const newChainId = 200
            let result = await instance.methods.setChainId(newChainId)
                .send({
                    from: deployAddress,
                    nonce: await web3.eth.getTransactionCount(deployAddress)
                })

            assert.ok(result)
            assert.ok(result.events)
            assert.ok(result.events.ChainIdChanged)
            assert.ok(result.events.ChainIdChanged.returnValues)
            assert.equal(result.events.ChainIdChanged.event, "ChainIdChanged")
            assert.equal(result.events.ChainIdChanged.returnValues.chainId, newChainId)
        })
    })

    describe("should create a process", () => {
        it("should allow anyone to create one", async () => {
            assert(instance.methods.create)

            // TODO: CHANGEME
            await instance.methods.create(ProcessEnvelopeType.REALTIME_POLL, ProcessMode.SCHEDULED_SINGLE_ENVELOPE, metadata, censusMerkleRoot, censusMerkleTree, startBlock, numberOfBlocks)
                .send({
                    from: entityAddress,
                    nonce: await web3.eth.getTransactionCount(entityAddress)
                })

            let processIdExpected = await instance.methods.getProcessId(entityAddress, 1).call()
            let processIdActual = await instance.methods.getNextProcessId(entityAddress).call()
            assert.equal(processIdExpected, processIdActual)

            await instance.methods.create(ProcessEnvelopeType.REALTIME_POLL, ProcessMode.SCHEDULED_SINGLE_ENVELOPE, metadata, censusMerkleRoot, censusMerkleTree, startBlock, numberOfBlocks)
                .send({
                    from: randomAddress1,
                    nonce: await web3.eth.getTransactionCount(randomAddress1)
                })

            processIdExpected = await instance.methods.getProcessId(randomAddress1, 1).call()
            processIdActual = await instance.methods.getNextProcessId(randomAddress1).call()
            assert.equal(processIdExpected, processIdActual)

            await instance.methods.create(ProcessEnvelopeType.REALTIME_POLL, ProcessMode.SCHEDULED_SINGLE_ENVELOPE, metadata, censusMerkleRoot, censusMerkleTree, startBlock, numberOfBlocks)
                .send({
                    from: randomAddress2,
                    nonce: await web3.eth.getTransactionCount(randomAddress2)
                })

            processIdExpected = await instance.methods.getProcessId(randomAddress2, 1).call()
            processIdActual = await instance.methods.getNextProcessId(randomAddress2).call()
            assert.equal(processIdExpected, processIdActual)
        })
        it("should emit an event", async () => {
            const expectedProcessId = await instance.methods.getNextProcessId(entityAddress).call()

            let result = await instance.methods.create(ProcessEnvelopeType.REALTIME_POLL, ProcessMode.SCHEDULED_SINGLE_ENVELOPE, metadata, censusMerkleRoot, censusMerkleTree, startBlock, numberOfBlocks).send({
                from: entityAddress,
                nonce: await web3.eth.getTransactionCount(entityAddress)
            })

            assert.ok(result)
            assert.ok(result.events)
            assert.ok(result.events.ProcessCreated)
            assert.ok(result.events.ProcessCreated.returnValues)
            assert.equal(result.events.ProcessCreated.event, "ProcessCreated")
            assert.equal(result.events.ProcessCreated.returnValues.entityAddress, entityAddress)
            assert.equal(result.events.ProcessCreated.returnValues.processId, expectedProcessId)
        })

        it("should increase the processCount of the entity on success", async () => {
            const prev = Number(await instance.methods.entityProcessCount(entityAddress).call())
            assert.equal(prev, 0)

            await instance.methods.create(ProcessEnvelopeType.REALTIME_POLL, ProcessMode.SCHEDULED_SINGLE_ENVELOPE, metadata, censusMerkleRoot, censusMerkleTree, startBlock, numberOfBlocks).send({
                from: entityAddress,
                nonce: await web3.eth.getTransactionCount(entityAddress)
            })

            const current = Number(await instance.methods.entityProcessCount(entityAddress).call())

            assert.equal(current, prev + 1, "processCount should have increased by 1")
        })
        it("should not increase the processCount of the entity on error", async () => {
            const prev = Number(await instance.methods.entityProcessCount(entityAddress).call())
            assert.equal(prev, 0)

            try {
                await instance.methods.create(ProcessEnvelopeType.REALTIME_POLL, ProcessMode.SCHEDULED_SINGLE_ENVELOPE, "", "", "", 0, 0).send({
                    from: entityAddress,
                    nonce: await web3.eth.getTransactionCount(entityAddress)
                })

                assert.fail("The transaction should have thrown an error but didn't")
            }
            catch (err) {
                assert(err.message.match(/revert/), "The transaction threw an unexpected error:\n" + err.message)
            }

            const current = Number(await instance.methods.entityProcessCount(entityAddress).call())

            assert.equal(current, prev, "processCount should not have changed")
        })
        it("retrieved metadata should match the one submitted", async () => {

            let metadata = "ipfs://ipfs/some-hash-here!sha3-hash"
            let censusMerkleRoot = "0x1234567890"
            let censusMerkleTree = "ipfs://ipfs/some-hash-there!sha3-hash-there"
            let startBlock = 12345678
            let numberOfBlocks = 50000

            // 1
            await instance.methods.create(ProcessEnvelopeType.REALTIME_POLL, ProcessMode.SCHEDULED_SINGLE_ENVELOPE, metadata, censusMerkleRoot, censusMerkleTree, startBlock, numberOfBlocks).send({
                from: entityAddress,
                nonce: await web3.eth.getTransactionCount(entityAddress)
            })

            let count = Number(await instance.methods.entityProcessCount(entityAddress).call())
            let processId = await instance.methods.getProcessId(entityAddress, count - 1).call()

            let processData = await instance.methods.get(processId).call()

            assert.equal(processData.envelopeType, 0)
            assert.equal(processData.mode, 0)
            assert.equal(processData.entityAddress, entityAddress)
            assert.equal(processData.metadata, metadata)
            assert.equal(processData.censusMerkleRoot, censusMerkleRoot)
            assert.equal(processData.censusMerkleRoot, censusMerkleRoot)
            assert.equal(processData.status, ProcessStatus.OPEN, "The process should start open")
            assert.equal(processData.startBlock, startBlock)
            assert.equal(processData.numberOfBlocks, numberOfBlocks)

            // 2
            metadata = "ipfs://ipfs/more-hash-there!sha3-hash"
            censusMerkleRoot = "0x00000001111122222333334444"
            censusMerkleTree = "ipfs://ipfs/more-hash-somewthere!sha3-hash-there"
            // voteEncryptionPublicKey = "TESTING-ENCRYPTION_KEY"
            startBlock = 23456789
            numberOfBlocks = 1000

            await instance.methods.create(ProcessEnvelopeType.ENCRYPTED_POLL, ProcessMode.SCHEDULED_SINGLE_ENVELOPE, metadata, censusMerkleRoot, censusMerkleTree, startBlock, numberOfBlocks).send({
                from: entityAddress,
                nonce: await web3.eth.getTransactionCount(entityAddress)
            })

            count = Number(await instance.methods.entityProcessCount(entityAddress).call())
            processId = await instance.methods.getProcessId(entityAddress, count - 1).call()

            processData = await instance.methods.get(processId).call()

            assert.equal(processData.envelopeType, 4)
            assert.equal(processData.mode, 0)
            assert.equal(processData.entityAddress, entityAddress)
            assert.equal(processData.metadata, metadata)
            assert.equal(processData.censusMerkleRoot, censusMerkleRoot)
            assert.equal(processData.censusMerkleRoot, censusMerkleRoot)
            assert.equal(processData.status, ProcessStatus.OPEN, "The process should start as open")
            assert.equal(processData.startBlock, startBlock)
            assert.equal(processData.numberOfBlocks, numberOfBlocks)
        })
    })

    describe("should cancel the process", () => {
        it("only when the entity account requests it", async () => {
            const processId1 = await instance.methods.getProcessId(entityAddress, 0).call()
            // Create
            const result1 = await instance.methods.create(ProcessEnvelopeType.PETITION_SIGNING, ProcessMode.SCHEDULED_SINGLE_ENVELOPE, metadata, censusMerkleRoot, censusMerkleTree, startBlock, numberOfBlocks).send({
                from: entityAddress,
                nonce: await web3.eth.getTransactionCount(entityAddress)
            })
            assert.equal(result1.events.ProcessCreated.returnValues.processId, processId1)

            // Canceled by the creator
            await setProcessStatus(instance, entityAddress, processId1, 2)
            const processData1 = await instance.methods.get(processId1).call()
            assert.equal(processData1.envelopeType, 1)
            assert.equal(processData1.mode, 0)
            assert.equal(processData1.entityAddress, entityAddress)
            assert.equal(processData1.metadata, metadata)
            assert.equal(processData1.status, ProcessStatus.CANCELED, "The process should now be canceled")

            // Create again
            const processId2 = await instance.methods.getProcessId(entityAddress, 1).call()
            // Create
            const result2 = await instance.methods.create(ProcessEnvelopeType.REALTIME_POLL, ProcessMode.SCHEDULED_SINGLE_ENVELOPE, metadata, censusMerkleRoot, censusMerkleTree, startBlock, numberOfBlocks).send({
                from: entityAddress,  // <<--
                nonce: await web3.eth.getTransactionCount(entityAddress)  // <<--
            })
            assert.equal(result2.events.ProcessCreated.returnValues.processId, processId2)

            // Try to cancel from another account
            try {
                await setProcessStatus(instance, randomAddress1, processId2, 2)
                assert.fail("The transaction should have thrown an error but didn't")
            }
            catch (err) {
                assert(err.message.match(/revert/), "The transaction threw an unexpected error:\n" + err.message)
            }

            const processData2 = await instance.methods.get(processId2).call()
            assert.equal(processData2.envelopeType, 0)
            assert.equal(processData2.mode, 0)
            assert.equal(processData2.entityAddress, entityAddress)
            assert.equal(processData2.metadata, metadata)
            assert.equal(processData2.status, ProcessStatus.OPEN, "The process should remain open")

        })
        it("if is not yet canceled", async () => {
            const processId1 = await instance.methods.getProcessId(entityAddress, 0).call()
            // Create
            // TODO: CHANGEME
            const result1 = await instance.methods.create(ProcessEnvelopeType.REALTIME_POLL, ProcessMode.SCHEDULED_SINGLE_ENVELOPE, metadata, censusMerkleRoot, censusMerkleTree, startBlock, numberOfBlocks).send({
                from: entityAddress,
                nonce: await web3.eth.getTransactionCount(entityAddress)
            })

            assert.equal(result1.events.ProcessCreated.returnValues.processId, processId1)

            // Canceled by the creator
            const result2 = await setProcessStatus(instance, entityAddress, processId1, 2)
            assert.ok(result2)
            assert.ok(result2.events)
            assert.ok(result2.events.ProcessStatusUpdated)
            assert.ok(result2.events.ProcessStatusUpdated.returnValues)
            assert.equal(result2.events.ProcessStatusUpdated.event, "ProcessStatusUpdated")
            assert.equal(result2.events.ProcessStatusUpdated.returnValues.processId, processId1)
            assert.equal(result2.events.ProcessStatusUpdated.returnValues.status, ProcessStatus.CANCELED)

            const processData1 = await instance.methods.get(processId1).call()
            assert.equal(processData1.envelopeType, 0)
            assert.equal(processData1.mode, 0)
            assert.equal(processData1.entityAddress, entityAddress)
            assert.equal(processData1.metadata, metadata)
            assert.equal(processData1.status, ProcessStatus.CANCELED, "The process should now be canceled")

            // Try to cancel again
            try {
                await setProcessStatus(instance, entityAddress, processId1, 2)
                assert.fail("The transaction should have thrown an error but didn't")
            }
            catch (err) {
                assert(err.message.match(/revert/), "The transaction threw an unexpected error:\n" + err.message)
            }

            // Nothing else should have changed
            const processData2 = await instance.methods.get(processId1).call()
            assert.equal(processData2.entityAddress, entityAddress)
            assert.equal(processData2.metadata, metadata)
            assert.equal(processData2.status, ProcessStatus.CANCELED, "The process should now be canceled")
        })

        it("if it not yet ended", async () => {
            const processId1 = await instance.methods.getProcessId(entityAddress, 0).call()
            // Create
            // TODO: CHANGEME
            const result1 = await instance.methods.create(ProcessEnvelopeType.REALTIME_POLL, ProcessMode.SCHEDULED_SINGLE_ENVELOPE, metadata, censusMerkleRoot, censusMerkleTree, startBlock, numberOfBlocks).send({
                from: entityAddress,
                nonce: await web3.eth.getTransactionCount(entityAddress)
            })

            assert.equal(result1.events.ProcessCreated.returnValues.processId, processId1)

            // Ended by the creator
            const result2 = await setProcessStatus(instance, entityAddress, processId1, 1)
            assert.ok(result2)
            assert.ok(result2.events)
            assert.ok(result2.events.ProcessStatusUpdated)
            assert.ok(result2.events.ProcessStatusUpdated.returnValues)
            assert.equal(result2.events.ProcessStatusUpdated.event, "ProcessStatusUpdated")
            assert.equal(result2.events.ProcessStatusUpdated.returnValues.processId, processId1)
            assert.equal(result2.events.ProcessStatusUpdated.returnValues.status, ProcessStatus.ENDED)

            const processData1 = await instance.methods.get(processId1).call()
            assert.equal(processData1.envelopeType, 0)
            assert.equal(processData1.mode, 0)
            assert.equal(processData1.entityAddress, entityAddress)
            assert.equal(processData1.metadata, metadata)
            assert.equal(processData1.status, ProcessStatus.ENDED, "The process should now be ended")

            // Try to cancel
            try {
                await setProcessStatus(instance, entityAddress, processId1, 2)
                assert.fail("The transaction should have thrown an error but didn't")
            }
            catch (err) {
                assert(err.message.match(/revert/), "The transaction threw an unexpected error:\n" + err.message)
            }

            // Nothing else should have changed
            const processData2 = await instance.methods.get(processId1).call()
            assert.equal(processData2.entityAddress, entityAddress)
            assert.equal(processData2.metadata, metadata)
            assert.equal(processData2.status, ProcessStatus.ENDED, "The process should not be canceled")
        })

        it("should emit an event", async () => {
            const processId1 = await instance.methods.getProcessId(entityAddress, 0).call()
            // Create
            // TODO: CHANGEME
            const result1 = await instance.methods.create(ProcessEnvelopeType.REALTIME_POLL, ProcessMode.SCHEDULED_SINGLE_ENVELOPE, metadata, censusMerkleRoot, censusMerkleTree, startBlock, numberOfBlocks).send({
                from: entityAddress,
                nonce: await web3.eth.getTransactionCount(entityAddress)
            })
            assert.equal(result1.events.ProcessCreated.returnValues.processId, processId1)

            // Canceled by the creator
            const result2 = await setProcessStatus(instance, entityAddress, processId1, 2)
            assert.ok(result2)
            assert.ok(result2.events)
            assert.ok(result2.events.ProcessStatusUpdated)
            assert.ok(result2.events.ProcessStatusUpdated.returnValues)
            assert.equal(result2.events.ProcessStatusUpdated.event, "ProcessStatusUpdated")
            assert.equal(result2.events.ProcessStatusUpdated.returnValues.processId, processId1)
            assert.equal(result2.events.ProcessStatusUpdated.returnValues.status, ProcessStatus.CANCELED)
        })
    })

    describe("should end the process", () => {
        it("only when the entity account requests it", async () => {
            const processId1 = await instance.methods.getProcessId(entityAddress, 0).call()
            // Create
            const result1 = await instance.methods.create(ProcessEnvelopeType.PETITION_SIGNING, ProcessMode.SCHEDULED_SINGLE_ENVELOPE, metadata, censusMerkleRoot, censusMerkleTree, startBlock, numberOfBlocks).send({
                from: entityAddress,
                nonce: await web3.eth.getTransactionCount(entityAddress)
            })
            assert.equal(result1.events.ProcessCreated.returnValues.processId, processId1)

            // Ended by the creator
            await setProcessStatus(instance, entityAddress, processId1, 1)

            const processData1 = await instance.methods.get(processId1).call()
            assert.equal(processData1.envelopeType, 1)
            assert.equal(processData1.mode, 0)
            assert.equal(processData1.entityAddress, entityAddress)
            assert.equal(processData1.metadata, metadata)
            assert.equal(processData1.status, ProcessStatus.ENDED, "The process should now be ended")

            // CREATE AGAIN
            const processId2 = await instance.methods.getProcessId(entityAddress, 1).call()
            // Create
            const result2 = await instance.methods.create(ProcessEnvelopeType.REALTIME_POLL, ProcessMode.SCHEDULED_SINGLE_ENVELOPE, metadata, censusMerkleRoot, censusMerkleTree, startBlock, numberOfBlocks).send({
                from: entityAddress,  // <<--
                nonce: await web3.eth.getTransactionCount(entityAddress)  // <<--
            })
            assert.equal(result2.events.ProcessCreated.returnValues.processId, processId2)

            // Try to end from another account
            try {
                await setProcessStatus(instance, randomAddress1, processId2, 1)
                assert.fail("The transaction should have thrown an error but didn't")
            }
            catch (err) {
                assert(err.message.match(/revert/), "The transaction threw an unexpected error:\n" + err.message)
            }

            const processData2 = await instance.methods.get(processId2).call()
            assert.equal(processData2.envelopeType, 0)
            assert.equal(processData2.mode, 0)
            assert.equal(processData2.entityAddress, entityAddress)
            assert.equal(processData2.metadata, metadata)
            assert.equal(processData2.status, ProcessStatus.OPEN, "The process should remain open")
        })

        it("if is not yet ended", async () => {
            const processId1 = await instance.methods.getProcessId(entityAddress, 0).call()
            // Create
            // TODO: CHANGEME
            const result1 = await instance.methods.create(ProcessEnvelopeType.REALTIME_POLL, ProcessMode.SCHEDULED_SINGLE_ENVELOPE, metadata, censusMerkleRoot, censusMerkleTree, startBlock, numberOfBlocks).send({
                from: entityAddress,
                nonce: await web3.eth.getTransactionCount(entityAddress)
            })
            assert.equal(result1.events.ProcessCreated.returnValues.processId, processId1)

            // Ended by the creator
            const result2 = await setProcessStatus(instance, entityAddress, processId1, 1)
            assert.ok(result2)
            assert.ok(result2.events)
            assert.ok(result2.events.ProcessStatusUpdated)
            assert.ok(result2.events.ProcessStatusUpdated.returnValues)
            assert.equal(result2.events.ProcessStatusUpdated.event, "ProcessStatusUpdated")
            assert.equal(result2.events.ProcessStatusUpdated.returnValues.processId, processId1)
            assert.equal(result2.events.ProcessStatusUpdated.returnValues.status, ProcessStatus.ENDED)

            const processData1 = await instance.methods.get(processId1).call()
            assert.equal(processData1.envelopeType, 0)
            assert.equal(processData1.mode, 0)
            assert.equal(processData1.entityAddress, entityAddress)
            assert.equal(processData1.metadata, metadata)
            assert.equal(processData1.status, ProcessStatus.ENDED, "The process should now be ended")

            // Try to end again
            try {
                await setProcessStatus(instance, entityAddress, processId1, 1)
                assert.fail("The transaction should have thrown an error but didn't")
            }
            catch (err) {
                assert(err.message.match(/revert/), "The transaction threw an unexpected error:\n" + err.message)
            }

            // Nothing else should have changed
            const processData2 = await instance.methods.get(processId1).call()
            assert.equal(processData2.entityAddress, entityAddress)
            assert.equal(processData2.metadata, metadata)
            assert.equal(processData2.status, ProcessStatus.ENDED, "The process should now be canceled")
        })

        it("if it not canceled", async () => {
            const processId1 = await instance.methods.getProcessId(entityAddress, 0).call()
            // Create
            // TODO: CHANGEME
            const result1 = await instance.methods.create(ProcessEnvelopeType.REALTIME_POLL, ProcessMode.SCHEDULED_SINGLE_ENVELOPE, metadata, censusMerkleRoot, censusMerkleTree, startBlock, numberOfBlocks).send({
                from: entityAddress,
                nonce: await web3.eth.getTransactionCount(entityAddress)
            })

            assert.equal(result1.events.ProcessCreated.returnValues.processId, processId1)

            // Canceled by the creator
            const result2 = await setProcessStatus(instance, entityAddress, processId1, 2)
            assert.ok(result2)
            assert.ok(result2.events)
            assert.ok(result2.events.ProcessStatusUpdated)
            assert.ok(result2.events.ProcessStatusUpdated.returnValues)
            assert.equal(result2.events.ProcessStatusUpdated.event, "ProcessStatusUpdated")
            assert.equal(result2.events.ProcessStatusUpdated.returnValues.processId, processId1)
            assert.equal(result2.events.ProcessStatusUpdated.returnValues.status, ProcessStatus.CANCELED)

            const processData1 = await instance.methods.get(processId1).call()
            assert.equal(processData1.envelopeType, 0)
            assert.equal(processData1.mode, 0)
            assert.equal(processData1.entityAddress, entityAddress)
            assert.equal(processData1.metadata, metadata)
            assert.equal(processData1.status, ProcessStatus.CANCELED, "The process should now be canceled")

            // Try to end
            try {
                await setProcessStatus(instance, entityAddress, processId1, 1)
                assert.fail("The transaction should have thrown an error but didn't")
            }
            catch (err) {
                assert(err.message.match(/revert/), "The transaction threw an unexpected error:\n" + err.message)
            }

            // Nothing else should have changed
            const processData2 = await instance.methods.get(processId1).call()
            assert.equal(processData2.entityAddress, entityAddress)
            assert.equal(processData2.metadata, metadata)
            assert.equal(processData2.status, ProcessStatus.CANCELED, "The process should be canceled")
        })

        it("should emit an event", async () => {
            const processId1 = await instance.methods.getProcessId(entityAddress, 0).call()
            // Create
            // TODO: CHANGEME
            const result1 = await instance.methods.create(ProcessEnvelopeType.REALTIME_POLL, ProcessMode.SCHEDULED_SINGLE_ENVELOPE, metadata, censusMerkleRoot, censusMerkleTree, startBlock, numberOfBlocks).send({
                from: entityAddress,
                nonce: await web3.eth.getTransactionCount(entityAddress)
            })
            assert.equal(result1.events.ProcessCreated.returnValues.processId, processId1)

            // Canceled by the creator
            const result2 = await setProcessStatus(instance, entityAddress, processId1, 1)
            assert.ok(result2)
            assert.ok(result2.events)
            assert.ok(result2.events.ProcessStatusUpdated)
            assert.ok(result2.events.ProcessStatusUpdated.returnValues)
            assert.equal(result2.events.ProcessStatusUpdated.event, "ProcessStatusUpdated")
            assert.equal(result2.events.ProcessStatusUpdated.returnValues.processId, processId1)
            assert.equal(result2.events.ProcessStatusUpdated.returnValues.status, ProcessStatus.ENDED)
        })
    })

    describe("should pause the process", () => {

        it("only if the entity account requests it", async () => {
            const processId1 = await instance.methods.getProcessId(entityAddress, 0).call()
            // Create
            const result1 = await instance.methods.create(ProcessEnvelopeType.PETITION_SIGNING, ProcessMode.SCHEDULED_SINGLE_ENVELOPE, metadata, censusMerkleRoot, censusMerkleTree, startBlock, numberOfBlocks).send({
                from: entityAddress,
                nonce: await web3.eth.getTransactionCount(entityAddress)
            })
            assert.equal(result1.events.ProcessCreated.returnValues.processId, processId1)

            // Paused by the creator
            await setProcessStatus(instance, entityAddress, processId1, 3)

            const processData1 = await instance.methods.get(processId1).call()
            assert.equal(processData1.envelopeType, 1)
            assert.equal(processData1.mode, 0)
            assert.equal(processData1.entityAddress, entityAddress)
            assert.equal(processData1.metadata, metadata)
            assert.equal(processData1.status, ProcessStatus.PAUSED, "The process should now be paused")

            // CREATE AGAIN
            const processId2 = await instance.methods.getProcessId(entityAddress, 1).call()

            // Create
            const result2 = await instance.methods.create(ProcessEnvelopeType.REALTIME_POLL, ProcessMode.SCHEDULED_SINGLE_ENVELOPE, metadata, censusMerkleRoot, censusMerkleTree, startBlock, numberOfBlocks).send({
                from: entityAddress,  // <<--
                nonce: await web3.eth.getTransactionCount(entityAddress)  // <<--
            })
            assert.equal(result2.events.ProcessCreated.returnValues.processId, processId2)

            // Try to end from another account
            try {
                await setProcessStatus(instance, randomAddress1, processId2, 3)
                assert.fail("The transaction should have thrown an error but didn't")
            }
            catch (err) {
                assert(err.message.match(/revert/), "The transaction threw an unexpected error:\n" + err.message)
            }

            const processData2 = await instance.methods.get(processId2).call()
            assert.equal(processData2.envelopeType, 0)
            assert.equal(processData2.mode, 0)
            assert.equal(processData2.entityAddress, entityAddress)
            assert.equal(processData2.metadata, metadata)
            assert.equal(processData2.status, ProcessStatus.OPEN, "The process should remain open")
        })

        it("if not canceled", async () => {
            const processId1 = await instance.methods.getProcessId(entityAddress, 0).call()
            // Create
            // TODO: CHANGEME
            const result1 = await instance.methods.create(ProcessEnvelopeType.REALTIME_POLL, ProcessMode.SCHEDULED_SINGLE_ENVELOPE, metadata, censusMerkleRoot, censusMerkleTree, startBlock, numberOfBlocks).send({
                from: entityAddress,
                nonce: await web3.eth.getTransactionCount(entityAddress)
            })
            assert.equal(result1.events.ProcessCreated.returnValues.processId, processId1)

            // Canceled by the creator
            const result2 = await setProcessStatus(instance, entityAddress, processId1, 2)
            assert.ok(result2)
            assert.ok(result2.events)
            assert.ok(result2.events.ProcessStatusUpdated)
            assert.ok(result2.events.ProcessStatusUpdated.returnValues)
            assert.equal(result2.events.ProcessStatusUpdated.event, "ProcessStatusUpdated")
            assert.equal(result2.events.ProcessStatusUpdated.returnValues.processId, processId1)
            assert.equal(result2.events.ProcessStatusUpdated.returnValues.status, ProcessStatus.CANCELED)

            const processData1 = await instance.methods.get(processId1).call()
            assert.equal(processData1.envelopeType, 0)
            assert.equal(processData1.mode, 0)
            assert.equal(processData1.entityAddress, entityAddress)
            assert.equal(processData1.metadata, metadata)
            assert.equal(processData1.status, ProcessStatus.CANCELED, "The process should now be canceled")

            // Try to pause
            try {
                await setProcessStatus(instance, entityAddress, processId1, 3)
                assert.fail("The transaction should have thrown an error but didn't")
            }
            catch (err) {
                assert(err.message.match(/revert/), "The transaction threw an unexpected error:\n" + err.message)
            }

            // Nothing else should have changed
            const processData2 = await instance.methods.get(processId1).call()
            assert.equal(processData2.entityAddress, entityAddress)
            assert.equal(processData2.metadata, metadata)
            assert.equal(processData2.status, ProcessStatus.CANCELED, "The process should be canceled")
        })

        it("if not ended", async () => {
            const processId1 = await instance.methods.getProcessId(entityAddress, 0).call()
            // Create
            // TODO: CHANGEME
            const result1 = await instance.methods.create(ProcessEnvelopeType.REALTIME_POLL, ProcessMode.SCHEDULED_SINGLE_ENVELOPE, metadata, censusMerkleRoot, censusMerkleTree, startBlock, numberOfBlocks).send({
                from: entityAddress,
                nonce: await web3.eth.getTransactionCount(entityAddress)
            })

            assert.equal(result1.events.ProcessCreated.returnValues.processId, processId1)

            // Ended by the creator
            const result2 = await setProcessStatus(instance, entityAddress, processId1, 1)
            assert.ok(result2)
            assert.ok(result2.events)
            assert.ok(result2.events.ProcessStatusUpdated)
            assert.ok(result2.events.ProcessStatusUpdated.returnValues)
            assert.equal(result2.events.ProcessStatusUpdated.event, "ProcessStatusUpdated")
            assert.equal(result2.events.ProcessStatusUpdated.returnValues.processId, processId1)
            assert.equal(result2.events.ProcessStatusUpdated.returnValues.status, ProcessStatus.ENDED)

            const processData1 = await instance.methods.get(processId1).call()
            assert.equal(processData1.envelopeType, 0)
            assert.equal(processData1.mode, 0)
            assert.equal(processData1.entityAddress, entityAddress)
            assert.equal(processData1.metadata, metadata)
            assert.equal(processData1.status, ProcessStatus.ENDED, "The process should now be ended")

            // Try to pause
            try {
                await setProcessStatus(instance, entityAddress, processId1, 3)
                assert.fail("The transaction should have thrown an error but didn't")
            }
            catch (err) {
                assert(err.message.match(/revert/), "The transaction threw an unexpected error:\n" + err.message)
            }

            // Nothing else should have changed
            const processData2 = await instance.methods.get(processId1).call()
            assert.equal(processData2.entityAddress, entityAddress)
            assert.equal(processData2.metadata, metadata)
            assert.equal(processData2.status, ProcessStatus.ENDED, "The process should be ended")
        })

        it("if not paused yet", async () => {
            const processId1 = await instance.methods.getProcessId(entityAddress, 0).call()
            // Create
            // TODO: CHANGEME
            const result1 = await instance.methods.create(ProcessEnvelopeType.REALTIME_POLL, ProcessMode.SCHEDULED_SINGLE_ENVELOPE, metadata, censusMerkleRoot, censusMerkleTree, startBlock, numberOfBlocks).send({
                from: entityAddress,
                nonce: await web3.eth.getTransactionCount(entityAddress)
            })
            assert.equal(result1.events.ProcessCreated.returnValues.processId, processId1)

            // Paused by the creator
            const result2 = await setProcessStatus(instance, entityAddress, processId1, 3)
            assert.ok(result2)
            assert.ok(result2.events)
            assert.ok(result2.events.ProcessStatusUpdated)
            assert.ok(result2.events.ProcessStatusUpdated.returnValues)
            assert.equal(result2.events.ProcessStatusUpdated.event, "ProcessStatusUpdated")
            assert.equal(result2.events.ProcessStatusUpdated.returnValues.processId, processId1)
            assert.equal(result2.events.ProcessStatusUpdated.returnValues.status, ProcessStatus.PAUSED)

            const processData1 = await instance.methods.get(processId1).call()
            assert.equal(processData1.envelopeType, 0)
            assert.equal(processData1.mode, 0)
            assert.equal(processData1.entityAddress, entityAddress)
            assert.equal(processData1.metadata, metadata)
            assert.equal(processData1.status, ProcessStatus.PAUSED, "The process should now be paused")

            // Try to pause
            try {
                await setProcessStatus(instance, entityAddress, processId1, 3)
                assert.fail("The transaction should have thrown an error but didn't")
            }
            catch (err) {
                assert(err.message.match(/revert/), "The transaction threw an unexpected error:\n" + err.message)
            }

            // Nothing else should have changed
            const processData2 = await instance.methods.get(processId1).call()
            assert.equal(processData2.entityAddress, entityAddress)
            assert.equal(processData2.metadata, metadata)
            assert.equal(processData2.status, ProcessStatus.PAUSED, "The process should be paused")
        })

        it("if opened", async () => {
            const processId1 = await instance.methods.getProcessId(entityAddress, 0).call()
            // Create
            // TODO: CHANGEME
            const result1 = await instance.methods.create(ProcessEnvelopeType.REALTIME_POLL, ProcessMode.SCHEDULED_SINGLE_ENVELOPE, metadata, censusMerkleRoot, censusMerkleTree, startBlock, numberOfBlocks).send({
                from: entityAddress,
                nonce: await web3.eth.getTransactionCount(entityAddress)
            })
            assert.equal(result1.events.ProcessCreated.returnValues.processId, processId1)

            // Canceled by the creator
            const result2 = await setProcessStatus(instance, entityAddress, processId1, 2)
            assert.ok(result2)
            assert.ok(result2.events)
            assert.ok(result2.events.ProcessStatusUpdated)
            assert.ok(result2.events.ProcessStatusUpdated.returnValues)
            assert.equal(result2.events.ProcessStatusUpdated.event, "ProcessStatusUpdated")
            assert.equal(result2.events.ProcessStatusUpdated.returnValues.processId, processId1)
            assert.equal(result2.events.ProcessStatusUpdated.returnValues.status, ProcessStatus.CANCELED)

            const processData1 = await instance.methods.get(processId1).call()
            assert.equal(processData1.envelopeType, 0)
            assert.equal(processData1.mode, 0)
            assert.equal(processData1.entityAddress, entityAddress)
            assert.equal(processData1.metadata, metadata)
            assert.equal(processData1.status, ProcessStatus.CANCELED, "The process should now be canceled")
        })

        it("should emit an event", async () => {
            const processId1 = await instance.methods.getProcessId(entityAddress, 0).call()
            // Create
            // TODO: CHANGEME
            const result1 = await instance.methods.create(ProcessEnvelopeType.REALTIME_POLL, ProcessMode.SCHEDULED_SINGLE_ENVELOPE, metadata, censusMerkleRoot, censusMerkleTree, startBlock, numberOfBlocks).send({
                from: entityAddress,
                nonce: await web3.eth.getTransactionCount(entityAddress)
            })
            assert.equal(result1.events.ProcessCreated.returnValues.processId, processId1)

            // Canceled by the creator
            const result2 = await setProcessStatus(instance, entityAddress, processId1, 3)
            assert.ok(result2)
            assert.ok(result2.events)
            assert.ok(result2.events.ProcessStatusUpdated)
            assert.ok(result2.events.ProcessStatusUpdated.returnValues)
            assert.equal(result2.events.ProcessStatusUpdated.event, "ProcessStatusUpdated")
            assert.equal(result2.events.ProcessStatusUpdated.returnValues.processId, processId1)
            assert.equal(result2.events.ProcessStatusUpdated.returnValues.status, ProcessStatus.PAUSED)

        })
    })

    describe("should open the process", () => {
        it("if not canceled", async () => {
            const processId1 = await instance.methods.getProcessId(entityAddress, 0).call()
            // Create
            // TODO: CHANGEME
            const result1 = await instance.methods.create(ProcessEnvelopeType.REALTIME_POLL, ProcessMode.SCHEDULED_SINGLE_ENVELOPE, metadata, censusMerkleRoot, censusMerkleTree, startBlock, numberOfBlocks).send({
                from: entityAddress,
                nonce: await web3.eth.getTransactionCount(entityAddress)
            })
            assert.equal(result1.events.ProcessCreated.returnValues.processId, processId1)

            // Canceled by the creator
            const result2 = await setProcessStatus(instance, entityAddress, processId1, 2)
            assert.ok(result2)
            assert.ok(result2.events)
            assert.ok(result2.events.ProcessStatusUpdated)
            assert.ok(result2.events.ProcessStatusUpdated.returnValues)
            assert.equal(result2.events.ProcessStatusUpdated.event, "ProcessStatusUpdated")
            assert.equal(result2.events.ProcessStatusUpdated.returnValues.processId, processId1)
            assert.equal(result2.events.ProcessStatusUpdated.returnValues.status, ProcessStatus.CANCELED)

            const processData1 = await instance.methods.get(processId1).call()
            assert.equal(processData1.envelopeType, 0)
            assert.equal(processData1.mode, 0)
            assert.equal(processData1.entityAddress, entityAddress)
            assert.equal(processData1.metadata, metadata)
            assert.equal(processData1.status, ProcessStatus.CANCELED, "The process should now be canceled")

            // Try to open
            try {
                await setProcessStatus(instance, entityAddress, processId1, 0)
                assert.fail("The transaction should have thrown an error but didn't")
            }
            catch (err) {
                assert(err.message.match(/revert/), "The transaction threw an unexpected error:\n" + err.message)
            }

            // Nothing else should have changed
            const processData2 = await instance.methods.get(processId1).call()

            assert.equal(processData2.entityAddress, entityAddress)
            assert.equal(processData2.metadata, metadata)
            assert.equal(processData2.status, ProcessStatus.CANCELED, "The process should be canceled")
        })

        it("if not ended", async () => {
            const processId1 = await instance.methods.getProcessId(entityAddress, 0).call()
            // Create
            // TODO: CHANGEME
            const result1 = await instance.methods.create(ProcessEnvelopeType.REALTIME_POLL, ProcessMode.SCHEDULED_SINGLE_ENVELOPE, metadata, censusMerkleRoot, censusMerkleTree, startBlock, numberOfBlocks).send({
                from: entityAddress,
                nonce: await web3.eth.getTransactionCount(entityAddress)
            })
            assert.equal(result1.events.ProcessCreated.returnValues.processId, processId1)

            // Ended by the creator
            const result2 = await setProcessStatus(instance, entityAddress, processId1, 1)
            assert.ok(result2)
            assert.ok(result2.events)
            assert.ok(result2.events.ProcessStatusUpdated)
            assert.ok(result2.events.ProcessStatusUpdated.returnValues)
            assert.equal(result2.events.ProcessStatusUpdated.event, "ProcessStatusUpdated")
            assert.equal(result2.events.ProcessStatusUpdated.returnValues.processId, processId1)
            assert.equal(result2.events.ProcessStatusUpdated.returnValues.status, ProcessStatus.ENDED)

            const processData1 = await instance.methods.get(processId1).call()
            assert.equal(processData1.envelopeType, 0)
            assert.equal(processData1.mode, 0)
            assert.equal(processData1.entityAddress, entityAddress)
            assert.equal(processData1.metadata, metadata)
            assert.equal(processData1.status, ProcessStatus.ENDED, "The process should now be ended")

            // Try to open
            try {
                await setProcessStatus(instance, entityAddress, processId1, 0)
                assert.fail("The transaction should have thrown an error but didn't")
            }
            catch (err) {
                assert(err.message.match(/revert/), "The transaction threw an unexpected error:\n" + err.message)
            }

            // Nothing else should have changed
            const processData2 = await instance.methods.get(processId1).call()
            assert.equal(processData2.entityAddress, entityAddress)
            assert.equal(processData2.metadata, metadata)
            assert.equal(processData2.status, ProcessStatus.ENDED, "The process should be ended")
        })

        it("if not opened yet", async () => {
            const processId1 = await instance.methods.getProcessId(entityAddress, 0).call()
            // Create
            // TODO: CHANGEME
            const result1 = await instance.methods.create(ProcessEnvelopeType.REALTIME_POLL, ProcessMode.SCHEDULED_SINGLE_ENVELOPE, metadata, censusMerkleRoot, censusMerkleTree, startBlock, numberOfBlocks).send({
                from: entityAddress,
                nonce: await web3.eth.getTransactionCount(entityAddress)
            })
            assert.equal(result1.events.ProcessCreated.returnValues.processId, processId1)

            // Try to open
            try {
                await setProcessStatus(instance, entityAddress, processId1, 0)
                assert.fail("The transaction should have thrown an error but didn't")
            }
            catch (err) {
                assert(err.message.match(/revert/), "The transaction threw an unexpected error:\n" + err.message)
            }

            // Nothing else should have changed
            const processData2 = await instance.methods.get(processId1).call()
            assert.equal(processData2.entityAddress, entityAddress)
            assert.equal(processData2.metadata, metadata)
            assert.equal(processData2.status, ProcessStatus.OPEN, "The process should be open")
        })

        it("if paused", async () => {
            const processId1 = await instance.methods.getProcessId(entityAddress, 0).call()
            // Create
            // TODO: CHANGEME
            const result1 = await instance.methods.create(ProcessEnvelopeType.REALTIME_POLL, ProcessMode.SCHEDULED_SINGLE_ENVELOPE, metadata, censusMerkleRoot, censusMerkleTree, startBlock, numberOfBlocks).send({
                from: entityAddress,
                nonce: await web3.eth.getTransactionCount(entityAddress)
            })
            assert.equal(result1.events.ProcessCreated.returnValues.processId, processId1)

            // Paused by the creator
            const result2 = await setProcessStatus(instance, entityAddress, processId1, 3)
            assert.ok(result2)
            assert.ok(result2.events)
            assert.ok(result2.events.ProcessStatusUpdated)
            assert.ok(result2.events.ProcessStatusUpdated.returnValues)
            assert.equal(result2.events.ProcessStatusUpdated.event, "ProcessStatusUpdated")
            assert.equal(result2.events.ProcessStatusUpdated.returnValues.processId, processId1)
            assert.equal(result2.events.ProcessStatusUpdated.returnValues.status, ProcessStatus.PAUSED)

            const processData1 = await instance.methods.get(processId1).call()
            assert.equal(processData1.envelopeType, 0)
            assert.equal(processData1.mode, 0)
            assert.equal(processData1.entityAddress, entityAddress)
            assert.equal(processData1.metadata, metadata)
            assert.equal(processData1.status, ProcessStatus.PAUSED, "The process should now be canceled")

            // Open by the creator
            const result3 = await setProcessStatus(instance, entityAddress, processId1, 0)
            assert.ok(result3)
            assert.ok(result3.events)
            assert.ok(result3.events.ProcessStatusUpdated)
            assert.ok(result3.events.ProcessStatusUpdated.returnValues)
            assert.equal(result3.events.ProcessStatusUpdated.event, "ProcessStatusUpdated")
            assert.equal(result3.events.ProcessStatusUpdated.returnValues.processId, processId1)
            assert.equal(result3.events.ProcessStatusUpdated.returnValues.status, ProcessStatus.OPEN)

            const processData2 = await instance.methods.get(processId1).call()
            assert.equal(processData2.envelopeType, 0)
            assert.equal(processData2.mode, 0)
            assert.equal(processData2.entityAddress, entityAddress)
            assert.equal(processData2.metadata, metadata)
            assert.equal(processData2.status, ProcessStatus.OPEN, "The process should now be open")
        })
    })

    describe("should register a validator", () => {

        const validatorPublicKey = "0x1234"
        const validatorPublicKey2 = "0x4321"

        it("only when the contract owner requests it", async () => {
            // Register a validator
            const result1 = await addValidator(instance, deployAddress, validatorPublicKey)
            assert.ok(result1.transactionHash)

            // Get validator list
            const result2 = await instance.methods.getValidators().call()
            assert.equal(result2.length, 1)

            // Attempt to add a validator by someone else
            try {
                await addValidator(instance, randomAddress1, validatorPublicKey)
                assert.fail("The transaction should have thrown an error but didn't")
            }
            catch (err) {
                assert(err.message.match(/revert/), "The transaction threw an unexpected error:\n" + err.message)
            }

            // Get validator list
            const result3 = await instance.methods.getValidators().call()
            assert.equal(result3.length, 1)
        })

        it("should add the validator public key to the validator list", async () => {
            // Register validator 1
            const result1 = await addValidator(instance, deployAddress, validatorPublicKey)
            assert.ok(result1.transactionHash)

            // Get validator list
            const result2 = await instance.methods.getValidators().call()
            assert.equal(result2.length, 1)
            assert.deepEqual(result2, [validatorPublicKey])

            // Adding validator #2
            const result3 = await addValidator(instance, deployAddress, validatorPublicKey2)
            assert.ok(result3.transactionHash)

            // Get validator list
            const result4 = await instance.methods.getValidators().call()
            assert.equal(result4.length, 2)

        })

        it("should not add the validator public key to the validator list if exists", async () => {
            // Register validator 1
            const result1 = await addValidator(instance, deployAddress, validatorPublicKey)
            assert.ok(result1.transactionHash)

            // Get validator list
            const result2 = await instance.methods.getValidators().call()
            assert.equal(result2.length, 1)
            assert.deepEqual(result2, [validatorPublicKey])

            // Adding validator #2
            try {
                await addValidator(instance, deployAddress, validatorPublicKey)
                assert.fail("The transaction should have thrown an error but didn't")
            } catch (err) {
                assert(err.message.match(/revert/), "The transaction threw an unexpected error:\n" + err.message)
            }

            // Get validator list
            const result3 = await instance.methods.getValidators().call()
            assert.equal(result3.length, 1)
        })

        it("should emit an event", async () => {
            // Register validator
            const result1 = await addValidator(instance, deployAddress, validatorPublicKey)
            assert.ok(result1)
            assert.ok(result1.events)
            assert.ok(result1.events.ValidatorAdded)
            assert.ok(result1.events.ValidatorAdded.returnValues)
            assert.equal(result1.events.ValidatorAdded.event, "ValidatorAdded")
            assert.equal(result1.events.ValidatorAdded.returnValues.validatorPublicKey, validatorPublicKey)
        })
    })

    describe("should remove a validator", () => {

        const validatorPublicKey = "0x1234"

        it("only when the contract owner account requests it", async () => {

            // Register validator
            const result1 = await addValidator(instance, deployAddress, validatorPublicKey)
            assert.ok(result1.transactionHash)

            // Attempt to disable the validator from someone else
            try {
                await removeValidator(instance, randomAddress1, 0, validatorPublicKey)
                assert.fail("The transaction should have thrown an error but didn't")
            }
            catch (err) {
                assert(err.message.match(/revert/), "The transaction threw an unexpected error:\n" + err.message)
            }

            // Get validator list
            const result2 = await instance.methods.getValidators().call()
            assert.equal(result2.length, 1)

            // Disable validator from the creator
            const result3 = await removeValidator(instance, deployAddress, 0, validatorPublicKey)
            assert.ok(result3.transactionHash)

            // Get validator list
            const result4 = await instance.methods.getValidators().call()
            assert.equal(result4.length, 0)
            assert.deepEqual(result4, [])
        })

        it("should fail if the idx does not match validatorPublicKey", async () => {
            const nonExistingValidatorPublicKey = "0x123123"

            // Register a validator
            const result2 = await addValidator(instance, deployAddress, validatorPublicKey)
            assert.ok(result2.transactionHash)

            // Attempt to disable non-existing validator
            try {
                await removeValidator(instance, randomAddress1, 5, nonExistingValidatorPublicKey)
                assert.fail("The transaction should have thrown an error but didn't")
            }
            catch (err) {
                assert(err.message.match(/revert/), "The transaction threw an unexpected error:\n" + err.message)
            }

            // Get validator list
            const result4 = await instance.methods.getValidators().call()
            assert.equal(result4.length, 1)
            assert.deepEqual(result4, [validatorPublicKey])
        })

        it("should emit an event", async () => {
            // Register validator
            await addValidator(instance, deployAddress, validatorPublicKey)
            // Disable validator
            const result1 = await removeValidator(instance, deployAddress, 0, validatorPublicKey)
            assert.ok(result1)
            assert.ok(result1.events)
            assert.ok(result1.events.ValidatorRemoved)
            assert.ok(result1.events.ValidatorRemoved.returnValues)
            assert.equal(result1.events.ValidatorRemoved.event, "ValidatorRemoved")
            assert.equal(result1.events.ValidatorRemoved.returnValues.validatorPublicKey, validatorPublicKey)
        })
    })


    describe("should register an oracle", () => {

        it("only when the contract owner requests it", async () => {
            // Register a oracle
            const result1 = await addOracle(instance, deployAddress, authorizedOracle1)
            assert.ok(result1.transactionHash)

            // Get oracle list
            const result2 = await instance.methods.getOracles().call()
            assert.equal(result2.length, 1)
            assert.deepEqual(result2, [authorizedOracle1])

            // Attempt to add a oracle by someone else
            try {
                await addOracle(instance, randomAddress2, authorizedOracle1)
                assert.fail("The transaction should have thrown an error but didn't")
            }
            catch (err) {
                assert(err.message.match(/revert/), "The transaction threw an unexpected error:\n" + err.message)
            }

            // Get oracle list
            const result3 = await instance.methods.getOracles().call()
            assert.equal(result3.length, 1)
            assert.deepEqual(result3, [authorizedOracle1])
        })

        it("should add the oracle address to the oracle list", async () => {
            // Register oracle 1
            const result1 = await addOracle(instance, deployAddress, authorizedOracle1)
            assert.ok(result1.transactionHash)

            // Get oracle list
            const result2 = await instance.methods.getOracles().call()
            assert.equal(result2.length, 1)
            assert.deepEqual(result2, [authorizedOracle1])

            // Adding oracle #2
            const result3 = await addOracle(instance, deployAddress, authorizedOracle2)
            assert.ok(result3.transactionHash)

            // Get oracle list
            const result4 = await instance.methods.getOracles().call()
            assert.equal(result4.length, 2)
        })

        it("should not add the oracle address to the oracle list if exists", async () => {
            // Register oracle 1
            const result1 = await addOracle(instance, deployAddress, authorizedOracle1)
            assert.ok(result1.transactionHash)

            // Get oracle list
            const result2 = await instance.methods.getOracles().call()
            assert.equal(result2.length, 1)
            assert.deepEqual(result2, [authorizedOracle1])

            // Adding oracle #2
            try {
                await addOracle(instance, deployAddress, authorizedOracle1)
                assert.fail("The transaction should have thrown an error but didn't")
            } catch (err) {
                assert(err.message.match(/revert/), "The transaction threw an unexpected error:\n" + err.message)
            }

            // Get oracle list
            const result3 = await instance.methods.getOracles().call()
            assert.equal(result3.length, 1)
        })

        it("should emit an event", async () => {
            // Register oracle
            const result1 = await addOracle(instance, deployAddress, authorizedOracle1)
            assert.ok(result1)
            assert.ok(result1.events)
            assert.ok(result1.events.OracleAdded)
            assert.ok(result1.events.OracleAdded.returnValues)
            assert.equal(result1.events.OracleAdded.event, "OracleAdded")
            assert.equal(result1.events.OracleAdded.returnValues.oracleAddress, authorizedOracle1)
        })
    })

    describe("should remove an oracle", () => {

        it("only when the contract owner requests it", async () => {
            // Register oracle
            const result1 = await addOracle(instance, deployAddress, authorizedOracle1)
            assert.ok(result1.transactionHash)

            // Attempt to disable the oracle from someone else
            try {
                await removeOracle(instance, randomAddress2, 0, authorizedOracle1)
                assert.fail("The transaction should have thrown an error but didn't")
            }
            catch (err) {
                assert(err.message.match(/revert/), "The transaction threw an unexpected error:\n" + err.message)
            }

            // Get oracle list
            const result2 = await instance.methods.getOracles().call()
            assert.equal(result2.length, 1)

            // Disable oracle from the creator
            const result3 = await removeOracle(instance, deployAddress, 0, authorizedOracle1)
            assert.ok(result3.transactionHash)

            // Get oracle list
            const result4 = await instance.methods.getOracles().call()
            assert.equal(result4.length, 0)
            assert.deepEqual(result4, [])
        })

        it("should fail if the idx is not valid", async () => {
            // Register a oracle
            const result1 = await addOracle(instance, deployAddress, authorizedOracle1)
            assert.ok(result1.transactionHash)

            // Register a oracle
            const result2 = await addOracle(instance, deployAddress, authorizedOracle2)
            assert.ok(result2.transactionHash)

            // Attempt to disable non-existing oracle
            try {
                await removeOracle(instance, deployAddress, 5, authorizedOracle2)
                assert.fail("The transaction should have thrown an error but didn't")
            }
            catch (err) {
                assert(err.message.match(/revert/), "The transaction threw an unexpected error:\n" + err.message)
            }

            // Get oracle list
            const result3 = await instance.methods.getOracles().call()
            assert.equal(result3.length, 2)
            assert.deepEqual(result3, [authorizedOracle1, authorizedOracle2])
        })

        it("should fail if the idx does not match oracleAddress", async () => {
            // Register a oracle
            const result1 = await addOracle(instance, deployAddress, authorizedOracle1)
            assert.ok(result1.transactionHash)

            // Register a oracle
            const result2 = await addOracle(instance, deployAddress, authorizedOracle2)
            assert.ok(result2.transactionHash)

            // Attempt to disable non-existing oracle
            try {
                await removeOracle(instance, deployAddress, 1, randomAddress2)
                assert.fail("The transaction should have thrown an error but didn't")
            }
            catch (err) {
                assert(err.message.match(/revert/), "The transaction threw an unexpected error:\n" + err.message)
            }

            // Get oracle list
            const result4 = await instance.methods.getOracles().call()
            assert.equal(result4.length, 2)
            assert.deepEqual(result4, [authorizedOracle1, authorizedOracle2])
        })

        it("should emit an event", async () => {
            // Register oracle
            await addOracle(instance, deployAddress, authorizedOracle1)

            // Disable oracle
            const result1 = await removeOracle(instance, deployAddress, 0, authorizedOracle1)
            assert.ok(result1)
            assert.ok(result1.events)
            assert.ok(result1.events.OracleRemoved)
            assert.ok(result1.events.OracleRemoved.returnValues)
            assert.equal(result1.events.OracleRemoved.event, "OracleRemoved")
            assert.equal(result1.events.OracleRemoved.returnValues.oracleAddress, authorizedOracle1)
        })
    })

    describe("should accept the results", () => {

        const results = "ipfs://12345!0987654321"

        it("only when the sender is an oracle", async () => {
            const processId = await instance.methods.getProcessId(entityAddress, 0).call()
            // Create
            const result1 = await instance.methods.create(ProcessEnvelopeType.ENCRYPTED_POLL, ProcessMode.SCHEDULED_SINGLE_ENVELOPE, metadata, censusMerkleRoot, censusMerkleTree, startBlock, numberOfBlocks).send({
                from: entityAddress,
                nonce: await web3.eth.getTransactionCount(entityAddress)
            })
            assert.ok(result1.transactionHash)

            // Attempt to publish the results by someone else
            try {
                await publishResults(instance, randomAddress1, processId, results)
                assert.fail("The transaction should have thrown an error but didn't")
            }
            catch (err) {
                assert(err.message.match(/revert/), "The transaction threw an unexpected error:\n" + err.message)
            }

            // Get results
            const result2 = await instance.methods.getResults(processId).call()
            assert.equal(result2, "", "There should be no results")

            // Register an oracle
            const result3 = await addOracle(instance, deployAddress, authorizedOracle1)
            assert.ok(result3.transactionHash)

            // Publish the results
            await publishResults(instance, authorizedOracle1, processId, results)

            // Get results
            const result4 = await instance.methods.getResults(processId).call()
            assert.equal(result4, results, "The results should match")
        }).timeout(6000)

        it("only when the processId exists", async () => {
            const nonExistingProcessId = "0x0123456789012345678901234567890123456789012345678901234567890123"
            // Register an oracle
            const result1 = await addOracle(instance, deployAddress, authorizedOracle1)
            assert.ok(result1.transactionHash)

            try {
                // Reveal the results
                await publishResults(instance, authorizedOracle1, nonExistingProcessId, results)
                assert.fail("The transaction should have thrown an error but didn't")
            }
            catch (err) {
                assert(err.message.match(/opcode/), "The transaction threw an unexpected error:\n" + err.message)
            }
        })

        it("only when the process is not canceled", async () => {
            const processId = await instance.methods.getProcessId(entityAddress, 0).call()

            // Create
            const result1 = await instance.methods.create(ProcessEnvelopeType.ENCRYPTED_POLL, ProcessMode.SCHEDULED_SINGLE_ENVELOPE, metadata, censusMerkleRoot, censusMerkleTree, startBlock, numberOfBlocks).send({
                from: entityAddress,
                nonce: await web3.eth.getTransactionCount(entityAddress)
            })
            assert.ok(result1.transactionHash)

            // Cancel the process
            const result2 = await instance.methods.setProcessStatus(processId, 2).send({
                from: entityAddress,
                nonce: await web3.eth.getTransactionCount(entityAddress)
            })
            assert.ok(result2.transactionHash)

            // Register an oracle
            const result3 = await addOracle(instance, deployAddress, authorizedOracle1)
            assert.ok(result3.transactionHash)

            // Attempt to publish the results after canceling
            try {
                await publishResults(instance, authorizedOracle1, processId, results)
                assert.fail("The transaction should have thrown an error but didn't")
            }
            catch (err) {
                assert(err.message.match(/revert/), "The transaction threw an unexpected error:\n" + err.message)
            }

            // Get results
            const result4 = await instance.methods.getResults(processId).call()
            assert.equal(result4, "", "There should be no results")
        }).timeout(5000)

        it("should retrieve the submited results", async () => {
            const processId = await instance.methods.getProcessId(entityAddress, 0).call()

            // Create
            const result1 = await instance.methods.create(ProcessEnvelopeType.REALTIME_POLL, ProcessMode.SCHEDULED_SINGLE_ENVELOPE, metadata, censusMerkleRoot, censusMerkleTree, startBlock, numberOfBlocks).send({
                from: entityAddress,
                nonce: await web3.eth.getTransactionCount(entityAddress)
            })
            assert.ok(result1.transactionHash)

            // Register an oracle
            const result2 = await addOracle(instance, deployAddress, authorizedOracle1)
            assert.ok(result2.transactionHash)

            // Publish the results
            await publishResults(instance, authorizedOracle1, processId, results)

            // Get results
            const result3 = await instance.methods.getResults(processId).call()
            assert.equal(result3, results, "The results should match")

        }).timeout(5000)

        it("should not publish twice", async () => {
            const processId = await instance.methods.getProcessId(entityAddress, 0).call()

            // Create
            const result1 = await instance.methods.create(ProcessEnvelopeType.REALTIME_POLL, ProcessMode.SCHEDULED_SINGLE_ENVELOPE, metadata, censusMerkleRoot, censusMerkleTree, startBlock, numberOfBlocks).send({
                from: entityAddress,
                nonce: await web3.eth.getTransactionCount(entityAddress)
            })
            assert.ok(result1.transactionHash)

            // Register an oracle
            const result2 = await addOracle(instance, deployAddress, authorizedOracle1)
            assert.ok(result2.transactionHash)

            // publish results
            await publishResults(instance, authorizedOracle1, processId, "INVALID_PRIVATE_KEY")

            // Get results
            const result3 = await instance.methods.getResults(processId).call()
            assert.equal(result3, "INVALID_PRIVATE_KEY", "The results should match the invalid one")

            // Try update the results
            try {
                await publishResults(instance, authorizedOracle1, processId, results)
                assert.fail("The transaction should have thrown an error but didn't")
            }
            catch (err) {
                assert(err.message.match(/revert/), "The transaction threw an unexpected error:\n" + err.message)
            }

            // Get results
            const result4 = await instance.methods.getResults(processId).call()
            assert.equal(result4, "INVALID_PRIVATE_KEY", "The results should match")
        }).timeout(5000)

        it("should emit an event", async () => {  // NOW + 3
            const processId = await instance.methods.getProcessId(entityAddress, 0).call()

            // Create
            const result1 = await instance.methods.create(ProcessEnvelopeType.REALTIME_POLL, ProcessMode.SCHEDULED_SINGLE_ENVELOPE, metadata, censusMerkleRoot, censusMerkleTree, startBlock, numberOfBlocks).send({
                from: entityAddress,
                nonce: await web3.eth.getTransactionCount(entityAddress)
            })
            assert.ok(result1.transactionHash)

            // wait until endTime
            await (new Promise(resolve => setTimeout(resolve, 4 * 1000)))
            // await increaseTimestamp(4)    // Not working with ganache by now

            // Register an oracle
            const result2 = await addOracle(instance, deployAddress, authorizedOracle1)
            assert.ok(result2.transactionHash)

            // Reveal the wrong results
            const result3 = await publishResults(instance, authorizedOracle1, processId, results)
            assert.ok(result3)
            assert.ok(result3.events)
            assert.ok(result3.events.ResultsPublished)
            assert.ok(result3.events.ResultsPublished.returnValues)
            assert.equal(result3.events.ResultsPublished.event, "ResultsPublished")
            assert.equal(result3.events.ResultsPublished.returnValues.processId, processId)
            assert.equal(result3.events.ResultsPublished.returnValues.results, results)
        }).timeout(5000)
    })

    describe("enum wrappers", () => {
        it("should handle valid envelope types", () => {
            let et = new ProcessEnvelopeType(0)
            assert.equal(et.isElection, false)
            assert.equal(et.isEncryptedPoll, false)
            assert.equal(et.isEncryptedPrivatePoll, false)
            assert.equal(et.isPetitionSigning, false)
            assert.equal(et.isPrivateElection, false)
            assert.equal(et.isRealtime, true)
            assert.equal(et.isRealtimeElection, false)
            assert.equal(et.isRealtimePoll, true)
            assert.equal(et.isRealtimePrivateElection, false)

            et = new ProcessEnvelopeType(1)
            assert.equal(et.isElection, false)
            assert.equal(et.isEncryptedPoll, false)
            assert.equal(et.isEncryptedPrivatePoll, false)
            assert.equal(et.isPetitionSigning, true)
            assert.equal(et.isPrivateElection, false)
            assert.equal(et.isRealtime, false)
            assert.equal(et.isRealtimeElection, false)
            assert.equal(et.isRealtimePoll, false)
            assert.equal(et.isRealtimePrivateElection, false)

            et = new ProcessEnvelopeType(4)
            assert.equal(et.isElection, false)
            assert.equal(et.isEncryptedPoll, true)
            assert.equal(et.isEncryptedPrivatePoll, false)
            assert.equal(et.isPetitionSigning, false)
            assert.equal(et.isPrivateElection, false)
            assert.equal(et.isRealtime, false)
            assert.equal(et.isRealtimeElection, false)
            assert.equal(et.isRealtimePoll, false)
            assert.equal(et.isRealtimePrivateElection, false)

            et = new ProcessEnvelopeType(6)
            assert.equal(et.isElection, false)
            assert.equal(et.isEncryptedPoll, false)
            assert.equal(et.isEncryptedPrivatePoll, true)
            assert.equal(et.isPetitionSigning, false)
            assert.equal(et.isPrivateElection, false)
            assert.equal(et.isRealtime, false)
            assert.equal(et.isRealtimeElection, false)
            assert.equal(et.isRealtimePoll, false)
            assert.equal(et.isRealtimePrivateElection, false)

            et = new ProcessEnvelopeType(8)
            assert.equal(et.isElection, false)
            assert.equal(et.isEncryptedPoll, false)
            assert.equal(et.isEncryptedPrivatePoll, false)
            assert.equal(et.isPetitionSigning, false)
            assert.equal(et.isPrivateElection, false)
            assert.equal(et.isRealtime, true)
            assert.equal(et.isRealtimeElection, true)
            assert.equal(et.isRealtimePoll, false)
            assert.equal(et.isRealtimePrivateElection, false)

            et = new ProcessEnvelopeType(10)
            assert.equal(et.isElection, false)
            assert.equal(et.isEncryptedPoll, false)
            assert.equal(et.isEncryptedPrivatePoll, false)
            assert.equal(et.isPetitionSigning, false)
            assert.equal(et.isPrivateElection, true)
            assert.equal(et.isRealtime, false)
            assert.equal(et.isRealtimeElection, false)
            assert.equal(et.isRealtimePoll, false)
            assert.equal(et.isRealtimePrivateElection, false)

            et = new ProcessEnvelopeType(12)
            assert.equal(et.isElection, true)
            assert.equal(et.isEncryptedPoll, false)
            assert.equal(et.isEncryptedPrivatePoll, false)
            assert.equal(et.isPetitionSigning, false)
            assert.equal(et.isPrivateElection, false)
            assert.equal(et.isRealtime, false)
            assert.equal(et.isRealtimeElection, false)
            assert.equal(et.isRealtimePoll, false)
            assert.equal(et.isRealtimePrivateElection, false)

            et = new ProcessEnvelopeType(14)
            assert.equal(et.isElection, false)
            assert.equal(et.isEncryptedPoll, false)
            assert.equal(et.isEncryptedPrivatePoll, false)
            assert.equal(et.isPetitionSigning, false)
            assert.equal(et.isPrivateElection, false)
            assert.equal(et.isRealtime, true)
            assert.equal(et.isRealtimeElection, false)
            assert.equal(et.isRealtimePoll, false)
            assert.equal(et.isRealtimePrivateElection, true)
        })

        it("should fail on invalid envelope types", () => {
            assert.throws(() => new ProcessEnvelopeType(2))
            assert.throws(() => new ProcessEnvelopeType(3))
            assert.throws(() => new ProcessEnvelopeType(5))
            assert.throws(() => new ProcessEnvelopeType(7))
            assert.throws(() => new ProcessEnvelopeType(9))
            assert.throws(() => new ProcessEnvelopeType(11))
            assert.throws(() => new ProcessEnvelopeType(13))
            assert.throws(() => new ProcessEnvelopeType(15))
            for (let i = 17; i < 1024; i++) assert.throws(() => new ProcessEnvelopeType(i))
        })

        it("should handle valid process modes", () => {
            let pm = new ProcessMode(0)
            assert.equal(pm.isScheduled, true)
            assert.equal(pm.isOnDemand, false)
            assert.equal(pm.isSingleEnvelope, true)

            pm = new ProcessMode(1)
            assert.equal(pm.isScheduled, false)
            assert.equal(pm.isOnDemand, true)
            assert.equal(pm.isSingleEnvelope, true)
        })

        it("should fail on invalid process modes", () => {
            for (let i = 2; i < 1024; i++) assert.throws(() => new ProcessMode(i))
        })

        it("should handle valid process status", () => {
            let pm = new ProcessStatus(0)
            assert.equal(pm.isOpen, true)
            assert.equal(pm.isEnded, false)
            assert.equal(pm.isCanceled, false)
            assert.equal(pm.isPaused, false)

            pm = new ProcessStatus(1)
            assert.equal(pm.isOpen, false)
            assert.equal(pm.isEnded, true)
            assert.equal(pm.isCanceled, false)
            assert.equal(pm.isPaused, false)

            pm = new ProcessStatus(2)
            assert.equal(pm.isOpen, false)
            assert.equal(pm.isEnded, false)
            assert.equal(pm.isCanceled, true)
            assert.equal(pm.isPaused, false)

            pm = new ProcessStatus(3)
            assert.equal(pm.isOpen, false)
            assert.equal(pm.isEnded, false)
            assert.equal(pm.isCanceled, false)
            assert.equal(pm.isPaused, true)
        })

        it("should fail on invalid process status", () => {
            for (let i = 4; i < 1024; i++) assert.throws(() => new ProcessStatus(i))
        })
    })
})
