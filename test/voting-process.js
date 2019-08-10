const assert = require("assert")
const { getWeb3, increaseTimestamp, deployVotingProcess } = require("../lib/util")

const web3 = getWeb3()

let accounts
let instance

let entityAddress, relayAddress, randomAddress1, randomAddress2

//const defaultResolver = "0x1234567890123456789012345678901234567890"
const defaultProcessName = "Process name"
const defaultMetadataContentUri = "bzz://1234,ipfs://ipfs/1234"
const defaultEncryptionPublicKey = "0x1234"

describe('VotingProcess', function () {

    beforeEach(async () => {
        accounts = await web3.eth.getAccounts()

        entityAddress = accounts[1]
        relayAddress = accounts[2]
        randomAddress1 = accounts[3]
        randomAddress2 = accounts[4]

        genesis  = "0x1234567890123456789012345678901234567890123123123"
        chainId  = 0

        instance = await deployVotingProcess()
    })


    it("should deploy the contract", async () => {
        const localInstance = await deployVotingProcess()

        assert.ok(localInstance)
        assert.ok(localInstance.options)
        assert.ok(localInstance.options.address.match(/^0x[0-9a-fA-F]{40}$/))
    })

    it("should compute a processId from the entity address and the process index", async () => {
        assert(instance.methods.getProcessId)
        assert(instance.methods.getProcessId.call)

        const proc1 = await instance.methods.getProcessId(accounts[0], 0, genesis, chainId).call()
        const proc2 = await instance.methods.getProcessId(accounts[0], 0, genesis, chainId).call()
        const proc3 = await instance.methods.getProcessId(accounts[0], 1, genesis, chainId).call()
        const proc4 = await instance.methods.getProcessId(accounts[0], 1, genesis, chainId).call()
        const proc5 = await instance.methods.getProcessId(accounts[0], 2, genesis, chainId).call()
        const proc6 = await instance.methods.getProcessId(accounts[0], 3, genesis, chainId).call()

        assert.equal(proc1, proc2)
        assert.equal(proc3, proc4)

        assert.notEqual(proc1, proc3)
        assert.notEqual(proc1, proc5)
        assert.notEqual(proc1, proc6)

        assert.notEqual(proc3, proc5)
        assert.notEqual(proc3, proc6)

        assert.notEqual(proc5, proc6)
    })

    it("should compute the next processId", async () => {
        assert(instance.methods.getNextProcessId)
        assert(instance.methods.getNextProcessId.call)

        // The entity has 0 processes at the moment
        // So the next process index is 0
        const processId1Expected = await instance.methods.getProcessId(entityAddress, 0, genesis, chainId).call()
        const processId1Actual = await instance.methods.getNextProcessId(entityAddress, genesis, chainId).call()

        assert.equal(processId1Expected, processId1Actual)

       

        await instance.methods.create(
            //defaultResolver,
            defaultProcessName,
            defaultMetadataContentUri,
            startTime,
            endTime,
            defaultEncryptionPublicKey
        ).send({
            from: entityAddress,
            nonce: await web3.eth.getTransactionCount(entityAddress)
        })

        // The entity has 1 process now
        // So the next process index is 1
        const processId2Expected = await instance.methods.getProcessId(entityAddress, 1).call()
        const processId2Actual = await instance.methods.getNextProcessId(entityAddress).call()

        assert.notEqual(processId1Actual, processId2Actual)
        assert.equal(processId2Expected, processId2Actual)
    })
/*
    describe("should create a process", () => {
        it("should allow anyone to create one", async () => {
            assert(instance.methods.create)

            let blockNumber = await web3.eth.getBlockNumber()
            let startTime = (await web3.eth.getBlock(blockNumber)).timestamp + 50
            let endTime = startTime + 50

            await instance.methods.create(
                defaultResolver,
                defaultProcessName,
                defaultMetadataContentUri,
                startTime,
                endTime,
                defaultEncryptionPublicKey)
                .send({
                    from: entityAddress,
                    nonce: await web3.eth.getTransactionCount(entityAddress)
                })

            let processIdExpected = await instance.methods.getProcessId(entityAddress, 1).call()
            let processIdActual = await instance.methods.getNextProcessId(entityAddress).call()
            assert.equal(processIdExpected, processIdActual)

            await instance.methods.create(
                defaultResolver,
                defaultProcessName,
                defaultMetadataContentUri,
                startTime,
                endTime,
                defaultEncryptionPublicKey)
                .send({
                    from: randomAddress1,
                    nonce: await web3.eth.getTransactionCount(randomAddress1)
                })

            processIdExpected = await instance.methods.getProcessId(randomAddress1, 1).call()
            processIdActual = await instance.methods.getNextProcessId(randomAddress1).call()
            assert.equal(processIdExpected, processIdActual)

            await instance.methods.create(
                defaultResolver,
                defaultProcessName,
                defaultMetadataContentUri,
                startTime,
                endTime,
                defaultEncryptionPublicKey)
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

            let blockNumber = await web3.eth.getBlockNumber()
            let startTime = (await web3.eth.getBlock(blockNumber)).timestamp + 50
            let endTime = startTime + 50

            let result = await instance.methods.create(
                defaultResolver,
                defaultProcessName,
                defaultMetadataContentUri,
                startTime,
                endTime,
                defaultEncryptionPublicKey
            ).send({
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
        it("should enforce startTime's greater than the current timestamp", async () => {
            let blockNumber = await web3.eth.getBlockNumber()
            let startTime = (await web3.eth.getBlock(blockNumber)).timestamp - 50  // <<--
            let endTime = (await web3.eth.getBlock(blockNumber)).timestamp + 50

            try {
                await instance.methods.create(
                    defaultResolver,
                    defaultProcessName,
                    defaultMetadataContentUri,
                    startTime,
                    endTime,
                    defaultEncryptionPublicKey
                ).send({
                    from: entityAddress,
                    nonce: await web3.eth.getTransactionCount(entityAddress)
                })

                assert.fail("The transaction should have thrown an error but didn't")
            }
            catch (err) {
                assert(err.message.match(/revert/), "The transaction threw an unexpected error:\n" + err.message)
            }

        })
        it("should enforce endTime's greater than the given startTime", async () => {
            // equal failing
            let blockNumber = await web3.eth.getBlockNumber()
            let startTime = (await web3.eth.getBlock(blockNumber)).timestamp + 50
            let endTime = startTime  // <<--

            try {
                await instance.methods.create(
                    defaultResolver,
                    defaultProcessName,
                    defaultMetadataContentUri,
                    startTime,
                    endTime,
                    defaultEncryptionPublicKey
                ).send({
                    from: entityAddress,
                    nonce: await web3.eth.getTransactionCount(entityAddress)
                })

                assert.fail("The transaction should have thrown an error but didn't")
            }
            catch (err) {
                assert(err.message.match(/revert/), "The transaction threw an unexpected error:\n" + err.message)
            }

            // Lower failing
            blockNumber = await web3.eth.getBlockNumber()
            startTime = (await web3.eth.getBlock(blockNumber)).timestamp + 50
            endTime = startTime - Math.ceil(100 * Math.random())   // <<--

            try {
                await instance.methods.create(
                    defaultResolver,
                    defaultProcessName,
                    defaultMetadataContentUri,
                    startTime,
                    endTime,
                    defaultEncryptionPublicKey
                ).send({
                    from: entityAddress,
                    nonce: await web3.eth.getTransactionCount(entityAddress)
                })

                assert.fail("The transaction should have thrown an error but didn't")
            }
            catch (err) {
                assert(err.message.match(/revert/), "The transaction threw an unexpected error:\n" + err.message)
            }
        })
        it("should increase the processCount of the entity on success", async () => {
            const prev = Number(await instance.methods.entityProcessCount(entityAddress).call())
            assert.equal(prev, 0)

            let blockNumber = await web3.eth.getBlockNumber()
            let startTime = (await web3.eth.getBlock(blockNumber)).timestamp + 50
            let endTime = startTime + 50

            await instance.methods.create(
                defaultResolver,
                defaultProcessName,
                defaultMetadataContentUri,
                startTime,
                endTime,
                defaultEncryptionPublicKey
            ).send({
                from: entityAddress,
                nonce: await web3.eth.getTransactionCount(entityAddress)
            })


            const current = Number(await instance.methods.entityProcessCount(entityAddress).call())

            assert.equal(current, prev + 1, "processCount should have increased by 1")
        })
        it("should not increase the processCount of the entity on error", async () => {
            const prev = Number(await instance.methods.entityProcessCount(entityAddress).call())
            assert.equal(prev, 0)

            let blockNumber = await web3.eth.getBlockNumber()
            let startTime = (await web3.eth.getBlock(blockNumber)).timestamp - 50   // <<--
            let endTime = startTime - 50   // <<--

            try {
                await instance.methods.create(
                    defaultResolver,
                    defaultProcessName,
                    defaultMetadataContentUri,
                    startTime,
                    endTime,
                    defaultEncryptionPublicKey
                ).send({
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
            const entityResolver = "0x0987654321098765432109876543210987654321"
            const processName = "PROCESS NAME TO TEST"
            const metadataContentUri = "ipfs://ipfs/some-hash-here"
            const voteEncryptionPublicKey = "TESTING-ENCRYPTION_KEY"

            let blockNumber = await web3.eth.getBlockNumber()
            let startTime = (await web3.eth.getBlock(blockNumber)).timestamp + 100
            let endTime = startTime + 100

            await instance.methods.create(
                entityResolver,
                processName,
                metadataContentUri,
                startTime,
                endTime,
                voteEncryptionPublicKey
            ).send({
                from: entityAddress,
                nonce: await web3.eth.getTransactionCount(entityAddress)
            })

            const count = Number(await instance.methods.entityProcessCount(entityAddress).call())
            const processId = await instance.methods.getProcessId(entityAddress, count - 1).call()

            const processData = await instance.methods.get(processId).call()

            assert.equal(processData.entityResolver, entityResolver)
            assert.equal(processData.entityAddress, entityAddress)
            assert.equal(processData.processName, processName)
            assert.equal(processData.metadataContentUri, metadataContentUri)
            assert.equal(processData.startTime, startTime)
            assert.equal(processData.endTime, endTime)
            assert.equal(processData.voteEncryptionPublicKey, voteEncryptionPublicKey)
            assert.equal(processData.canceled, false, "The process should not start as canceled")

            const privateKey = await instance.methods.getPrivateKey(processId).call()
            assert.equal(privateKey, "")
        })
    })

    describe("should cancel the process", () => {
        it("only when the creator requests it", async () => {
            let blockNumber = await web3.eth.getBlockNumber()
            let startTime = (await web3.eth.getBlock(blockNumber)).timestamp + 50
            let endTime = startTime + 50

            const processId1 = await instance.methods.getProcessId(entityAddress, 0).call()

            // Create
            const result1 = await instance.methods.create(
                defaultResolver,
                defaultProcessName,
                defaultMetadataContentUri,
                startTime,
                endTime,
                defaultEncryptionPublicKey
            ).send({
                from: entityAddress,
                nonce: await web3.eth.getTransactionCount(entityAddress)
            })

            assert.equal(result1.events.ProcessCreated.returnValues.processId, processId1)


            // Canceled by the creator
            await instance.methods.cancel(processId1).send({
                from: entityAddress,
                nonce: await web3.eth.getTransactionCount(entityAddress)
            })

            const processData1 = await instance.methods.get(processId1).call()

            assert.equal(processData1.entityResolver, defaultResolver)
            assert.equal(processData1.entityAddress, entityAddress)
            assert.equal(processData1.processName, defaultProcessName)
            assert.equal(processData1.metadataContentUri, defaultMetadataContentUri)
            assert.equal(processData1.startTime, startTime)
            assert.equal(processData1.endTime, endTime)
            assert.equal(processData1.voteEncryptionPublicKey, defaultEncryptionPublicKey)
            assert.equal(processData1.canceled, true, "The process should now be canceled")

            // CREATE AGAIN

            const processId2 = await instance.methods.getProcessId(entityAddress, 1).call()

            // Create
            const result3 = await instance.methods.create(
                defaultResolver,
                defaultProcessName,
                defaultMetadataContentUri,
                startTime,
                endTime,
                defaultEncryptionPublicKey
            ).send({
                from: entityAddress,  // <<--
                nonce: await web3.eth.getTransactionCount(entityAddress)  // <<--
            })

            assert.equal(result3.events.ProcessCreated.returnValues.processId, processId2)

            // Try to cancel from another account
            try {
                await instance.methods.cancel(processId2).send({
                    from: randomAddress1,  // <<--
                    nonce: await web3.eth.getTransactionCount(randomAddress1)  // <<--
                })

                assert.fail("The transaction should have thrown an error but didn't")
            }
            catch (err) {
                assert(err.message.match(/revert/), "The transaction threw an unexpected error:\n" + err.message)
            }

            const processData2 = await instance.methods.get(processId2).call()

            assert.equal(processData2.entityResolver, defaultResolver)
            assert.equal(processData2.entityAddress, entityAddress)
            assert.equal(processData2.processName, defaultProcessName)
            assert.equal(processData2.metadataContentUri, defaultMetadataContentUri)
            assert.equal(processData2.startTime, startTime)
            assert.equal(processData2.endTime, endTime)
            assert.equal(processData2.voteEncryptionPublicKey, defaultEncryptionPublicKey)
            assert.equal(processData2.canceled, false, "The process should remain active")

        })
        it("only if it not yet canceled", async () => {
            let blockNumber = await web3.eth.getBlockNumber()
            let startTime = (await web3.eth.getBlock(blockNumber)).timestamp + 50
            let endTime = startTime + 50

            const processId1 = await instance.methods.getProcessId(entityAddress, 0).call()

            // Create
            const result1 = await instance.methods.create(
                defaultResolver,
                defaultProcessName,
                defaultMetadataContentUri,
                startTime,
                endTime,
                defaultEncryptionPublicKey
            ).send({
                from: entityAddress,
                nonce: await web3.eth.getTransactionCount(entityAddress)
            })

            assert.equal(result1.events.ProcessCreated.returnValues.processId, processId1)

            // Canceled by the creator
            const result2 = await instance.methods.cancel(processId1).send({
                from: entityAddress,
                nonce: await web3.eth.getTransactionCount(entityAddress)
            })

            assert.ok(result2)
            assert.ok(result2.events)
            assert.ok(result2.events.ProcessCanceled)
            assert.ok(result2.events.ProcessCanceled.returnValues)
            assert.equal(result2.events.ProcessCanceled.event, "ProcessCanceled")
            assert.equal(result2.events.ProcessCanceled.returnValues.processId, processId1)

            const processData1 = await instance.methods.get(processId1).call()

            assert.equal(processData1.entityResolver, defaultResolver)
            assert.equal(processData1.entityAddress, entityAddress)
            assert.equal(processData1.processName, defaultProcessName)
            assert.equal(processData1.metadataContentUri, defaultMetadataContentUri)
            assert.equal(processData1.startTime, startTime)
            assert.equal(processData1.endTime, endTime)
            assert.equal(processData1.voteEncryptionPublicKey, defaultEncryptionPublicKey)
            assert.equal(processData1.canceled, true, "The process should now be canceled")

            // Try to cancel again
            try {
                await instance.methods.cancel(processId1).send({
                    from: entityAddress,
                    nonce: await web3.eth.getTransactionCount(entityAddress)
                })

                assert.fail("The transaction should have thrown an error but didn't")
            }
            catch (err) {
                assert(err.message.match(/revert/), "The transaction threw an unexpected error:\n" + err.message)
            }

            // Nothing else should have changed
            const processData2 = await instance.methods.get(processId1).call()

            assert.equal(processData2.entityResolver, defaultResolver)
            assert.equal(processData2.entityAddress, entityAddress)
            assert.equal(processData2.processName, defaultProcessName)
            assert.equal(processData2.metadataContentUri, defaultMetadataContentUri)
            assert.equal(processData2.startTime, startTime)
            assert.equal(processData2.endTime, endTime)
            assert.equal(processData2.voteEncryptionPublicKey, defaultEncryptionPublicKey)
            assert.equal(processData2.canceled, true, "The process should now be canceled")

        })
        it("not after startTime", async () => {
            let blockNumber = await web3.eth.getBlockNumber()
            let startTime = (await web3.eth.getBlock(blockNumber)).timestamp + 2  // <<--
            let endTime = startTime + 50

            // Create
            const result1 = await instance.methods.create(
                defaultResolver,
                defaultProcessName,
                defaultMetadataContentUri,
                startTime,
                endTime,
                defaultEncryptionPublicKey
            ).send({
                from: entityAddress,
                nonce: await web3.eth.getTransactionCount(entityAddress)
            })

            const processId1 = result1.events.ProcessCreated.returnValues.processId

            await (new Promise(resolve => setTimeout(resolve, 4 * 1000)))   // <<--
            // await increaseTimestamp(4)    // Not working with ganache by now

            // The creator attempts to cancel after startTime
            try {
                await instance.methods.cancel(processId1).send({
                    from: entityAddress,
                    nonce: await web3.eth.getTransactionCount(entityAddress)
                })

                assert.fail("The transaction should have thrown an error but didn't")
            }
            catch (err) {
                assert(err.message.match(/revert/), "The transaction threw an unexpected error:\n" + err.message)
            }

            // Nothing else should have changed
            const processData2 = await instance.methods.get(processId1).call()

            assert.equal(processData2.entityResolver, defaultResolver)
            assert.equal(processData2.entityAddress, entityAddress)
            assert.equal(processData2.processName, defaultProcessName)
            assert.equal(processData2.metadataContentUri, defaultMetadataContentUri)
            assert.equal(processData2.startTime, startTime)
            assert.equal(processData2.endTime, endTime)
            assert.equal(processData2.voteEncryptionPublicKey, defaultEncryptionPublicKey)
            assert.equal(processData2.canceled, false, "The process should remain active")

        }).timeout(5000)

        it("should emit an event", async () => {
            let blockNumber = await web3.eth.getBlockNumber()
            let startTime = (await web3.eth.getBlock(blockNumber)).timestamp + 50
            let endTime = startTime + 50

            const processId1 = await instance.methods.getProcessId(entityAddress, 0).call()

            // Create
            const result1 = await instance.methods.create(
                defaultResolver,
                defaultProcessName,
                defaultMetadataContentUri,
                startTime,
                endTime,
                defaultEncryptionPublicKey
            ).send({
                from: entityAddress,
                nonce: await web3.eth.getTransactionCount(entityAddress)
            })

            assert.equal(result1.events.ProcessCreated.returnValues.processId, processId1)

            // Canceled by the creator
            const result2 = await instance.methods.cancel(processId1).send({
                from: entityAddress,
                nonce: await web3.eth.getTransactionCount(entityAddress)
            })

            assert.ok(result2)
            assert.ok(result2.events)
            assert.ok(result2.events.ProcessCanceled)
            assert.ok(result2.events.ProcessCanceled.returnValues)
            assert.equal(result2.events.ProcessCanceled.event, "ProcessCanceled")
            assert.equal(result2.events.ProcessCanceled.returnValues.processId, processId1)

        })
        it("should return an empty relay list after a process is canceled", async () => {
            let blockNumber = await web3.eth.getBlockNumber()
            let startTime = (await web3.eth.getBlock(blockNumber)).timestamp + 50
            let endTime = startTime + 50

            const relayPublicKey = "0x1234"
            const relayMessagingUri = `pss://${relayPublicKey}@my-test-topic`

            const processId = await instance.methods.getProcessId(entityAddress, 0).call()

            // Create
            const result1 = await instance.methods.create(
                defaultResolver,
                defaultProcessName,
                defaultMetadataContentUri,
                startTime,
                endTime,
                defaultEncryptionPublicKey
            ).send({
                from: entityAddress,
                nonce: await web3.eth.getTransactionCount(entityAddress)
            })

            assert.equal(result1.events.ProcessCreated.returnValues.processId, processId)

            // Register a relay
            const result2 = await instance.methods.addRelay(
                processId,
                relayAddress,
                relayPublicKey,
                relayMessagingUri
            ).send({
                from: entityAddress,
                nonce: await web3.eth.getTransactionCount(entityAddress)
            })

            assert.ok(result2.transactionHash)

            const relayList1 = await instance.methods.getRelayIndex(processId).call()
            assert.equal(relayList1.length, 1)
            assert.deepEqual(relayList1, [relayAddress])

            // Canceled by the creator
            await instance.methods.cancel(processId).send({
                from: entityAddress,
                nonce: await web3.eth.getTransactionCount(entityAddress)
            })

            const relayList2 = await instance.methods.getRelayIndex(processId).call()
            assert.equal(relayList2.length, 0)
            assert.deepEqual(relayList2, [])
        })
    })

    describe("should register a relay", () => {

        const relayPublicKey = "0x1234"
        const relayMessagingUri = `pss://${relayPublicKey}@my-test-topic`

        it("only when the creator requests it", async () => {
            let blockNumber = await web3.eth.getBlockNumber()
            let startTime = (await web3.eth.getBlock(blockNumber)).timestamp + 50
            let endTime = startTime + 50

            const processId = await instance.methods.getProcessId(entityAddress, 0).call()

            // Create
            const result1 = await instance.methods.create(
                defaultResolver,
                defaultProcessName,
                defaultMetadataContentUri,
                startTime,
                endTime,
                defaultEncryptionPublicKey
            ).send({
                from: entityAddress,
                nonce: await web3.eth.getTransactionCount(entityAddress)
            })

            assert.ok(result1.transactionHash)

            // Register a relay
            const result2 = await instance.methods.addRelay(
                processId,
                relayAddress,
                relayPublicKey,
                relayMessagingUri
            ).send({
                from: entityAddress,
                nonce: await web3.eth.getTransactionCount(entityAddress)
            })

            assert.ok(result2.transactionHash)

            // Get relay list
            const result3 = await instance.methods.getRelayIndex(processId).call()
            assert.equal(result3.length, 1)
            assert.deepEqual(result3, [relayAddress])

            // Attempt to add a relay by someone else
            try {
                await instance.methods.addRelay(
                    processId,
                    randomAddress2,
                    relayPublicKey,
                    relayMessagingUri
                ).send({
                    from: randomAddress1, // <<--
                    nonce: await web3.eth.getTransactionCount(randomAddress1)
                })

                assert.fail("The transaction should have thrown an error but didn't")
            }
            catch (err) {
                assert(err.message.match(/revert/), "The transaction threw an unexpected error:\n" + err.message)
            }

            // Get relay list
            const result4 = await instance.methods.getRelayIndex(processId).call()
            assert.equal(result4.length, 1)
            assert.deepEqual(result4, [relayAddress])

        })
        it("only when the processId exists", async () => {

            const nonExistingProcessId = "0x0123456789012345678901234567890123456789012345678901234567890123"

            // Attempt to add a relay to a random processId
            try {
                await instance.methods.addRelay(
                    nonExistingProcessId,
                    randomAddress2,
                    relayPublicKey,
                    relayMessagingUri
                ).send({
                    from: entityAddress,
                    nonce: await web3.eth.getTransactionCount(entityAddress)
                })

                assert.fail("The transaction should have thrown an error but didn't")
            }
            catch (err) {
                assert(err.message.match(/revert/), "The transaction threw an unexpected error:\n" + err.message)
            }

            // Get relay list
            const result4 = await instance.methods.getRelayIndex(nonExistingProcessId).call()
            assert.equal(result4.length, 0)
            assert.deepEqual(result4, [])

        })
        it("only when the process is not canceled", async () => {
            let blockNumber = await web3.eth.getBlockNumber()
            let startTime = (await web3.eth.getBlock(blockNumber)).timestamp + 50
            let endTime = startTime + 50

            const processId = await instance.methods.getProcessId(entityAddress, 0).call()

            // Create
            const result1 = await instance.methods.create(
                defaultResolver,
                defaultProcessName,
                defaultMetadataContentUri,
                startTime,
                endTime,
                defaultEncryptionPublicKey
            ).send({
                from: entityAddress,
                nonce: await web3.eth.getTransactionCount(entityAddress)
            })

            assert.equal(result1.events.ProcessCreated.returnValues.processId, processId)

            // Canceled by the creator
            const result2 = await instance.methods.cancel(processId).send({
                from: entityAddress,
                nonce: await web3.eth.getTransactionCount(entityAddress)
            })

            assert.equal(result2.events.ProcessCanceled.returnValues.processId, processId)

            // Attempt to add a relay after being canceled
            try {
                await instance.methods.addRelay(
                    processId,
                    relayAddress,
                    relayPublicKey,
                    relayMessagingUri
                ).send({
                    from: entityAddress,
                    nonce: await web3.eth.getTransactionCount(entityAddress)
                })

                assert.fail("The transaction should have thrown an error but didn't")
            }
            catch (err) {
                assert(err.message.match(/revert/), "The transaction threw an unexpected error:\n" + err.message)
            }

            // Get relay list
            const result4 = await instance.methods.getRelayIndex(processId).call()
            assert.equal(result4.length, 0)
            assert.deepEqual(result4, [])

        })
        it("should fail if it already exists as active", async () => {
            let blockNumber = await web3.eth.getBlockNumber()
            let startTime = (await web3.eth.getBlock(blockNumber)).timestamp + 50
            let endTime = startTime + 50

            const processId = await instance.methods.getProcessId(entityAddress, 0).call()

            // Create
            const result1 = await instance.methods.create(
                defaultResolver,
                defaultProcessName,
                defaultMetadataContentUri,
                startTime,
                endTime,
                defaultEncryptionPublicKey
            ).send({
                from: entityAddress,
                nonce: await web3.eth.getTransactionCount(entityAddress)
            })

            assert.ok(result1.transactionHash)

            // Register a relay
            const result2 = await instance.methods.addRelay(
                processId,
                relayAddress,
                relayPublicKey,
                relayMessagingUri
            ).send({
                from: entityAddress,
                nonce: await web3.eth.getTransactionCount(entityAddress)
            })

            assert.ok(result2.transactionHash)

            // Get relay list
            const result3 = await instance.methods.getRelayIndex(processId).call()
            assert.equal(result3.length, 1)
            assert.deepEqual(result3, [relayAddress])

            // Attempt to add a relay by someone else
            try {
                await instance.methods.addRelay(
                    processId,
                    relayAddress,
                    relayPublicKey,
                    relayMessagingUri
                ).send({
                    from: entityAddress,
                    nonce: await web3.eth.getTransactionCount(entityAddress)
                })

                assert.fail("The transaction should have thrown an error but didn't")
            }
            catch (err) {
                assert(err.message.match(/revert/), "The transaction threw an unexpected error:\n" + err.message)
            }

            // Get relay list
            const result4 = await instance.methods.getRelayIndex(processId).call()
            assert.equal(result4.length, 1)
            assert.deepEqual(result4, [relayAddress])

        })
        it("should add the relay address to the relay list", async () => {
            let blockNumber = await web3.eth.getBlockNumber()
            let startTime = (await web3.eth.getBlock(blockNumber)).timestamp + 50
            let endTime = startTime + 50

            const processId = await instance.methods.getProcessId(entityAddress, 0).call()

            // Create
            const result1 = await instance.methods.create(
                defaultResolver,
                defaultProcessName,
                defaultMetadataContentUri,
                startTime,
                endTime,
                defaultEncryptionPublicKey
            ).send({
                from: entityAddress,
                nonce: await web3.eth.getTransactionCount(entityAddress)
            })

            assert.ok(result1.transactionHash)

            // Register relay 1
            const result2 = await instance.methods.addRelay(
                processId,
                relayAddress,
                relayPublicKey,
                relayMessagingUri
            ).send({
                from: entityAddress,
                nonce: await web3.eth.getTransactionCount(entityAddress)
            })

            assert.ok(result2.transactionHash)

            // Get relay list
            const result3 = await instance.methods.getRelayIndex(processId).call()
            assert.equal(result3.length, 1)
            assert.deepEqual(result3, [relayAddress])

            // Adding relay #2
            const result4 = await instance.methods.addRelay(
                processId,
                randomAddress1,
                relayPublicKey,
                relayMessagingUri
            ).send({
                from: entityAddress,
                nonce: await web3.eth.getTransactionCount(entityAddress)
            })

            assert.ok(result4.transactionHash)


            // Get relay list
            const result5 = await instance.methods.getRelayIndex(processId).call()
            assert.equal(result5.length, 2)
            assert.deepEqual(result5, [relayAddress, randomAddress1])

        })
        it("should return true on isActiveRelay", async () => {
            let blockNumber = await web3.eth.getBlockNumber()
            let startTime = (await web3.eth.getBlock(blockNumber)).timestamp + 50
            let endTime = startTime + 50

            const processId = await instance.methods.getProcessId(entityAddress, 0).call()

            // Create
            const result1 = await instance.methods.create(
                defaultResolver,
                defaultProcessName,
                defaultMetadataContentUri,
                startTime,
                endTime,
                defaultEncryptionPublicKey
            ).send({
                from: entityAddress,
                nonce: await web3.eth.getTransactionCount(entityAddress)
            })

            assert.ok(result1.transactionHash)

            // Register relay
            const result2 = await instance.methods.addRelay(
                processId,
                relayAddress,
                relayPublicKey,
                relayMessagingUri
            ).send({
                from: entityAddress,
                nonce: await web3.eth.getTransactionCount(entityAddress)
            })

            assert.ok(result2.transactionHash)

            // Retrieve relay status
            const result3 = await instance.methods.isActiveRelay(processId, relayAddress).call()

            assert(result3, "Relay should be active when created")

        })
        it("should retrieve a given relay's data", async () => {

            const relayPublicKey = "0x5678"
            const relayMessagingUri = `pss://${relayPublicKey}@my-test-topic-2`
            let blockNumber = await web3.eth.getBlockNumber()
            let startTime = (await web3.eth.getBlock(blockNumber)).timestamp + 50
            let endTime = startTime + 50

            const processId = await instance.methods.getProcessId(entityAddress, 0).call()

            // Create
            const result1 = await instance.methods.create(
                defaultResolver,
                defaultProcessName,
                defaultMetadataContentUri,
                startTime,
                endTime,
                defaultEncryptionPublicKey
            ).send({
                from: entityAddress,
                nonce: await web3.eth.getTransactionCount(entityAddress)
            })

            assert.equal(result1.events.ProcessCreated.returnValues.processId, processId)

            // Register relay
            const result2 = await instance.methods.addRelay(
                processId,
                relayAddress,
                relayPublicKey,
                relayMessagingUri
            ).send({
                from: entityAddress,
                nonce: await web3.eth.getTransactionCount(entityAddress)
            })

            assert.ok(result2.transactionHash)

            // Get relay status
            const result3 = await instance.methods.getRelay(processId, relayAddress).call()
            assert.equal(result3.publicKey, relayPublicKey)
            assert.equal(result3.messagingUri, relayMessagingUri)

        })
        it("should emit an event", async () => {
            let blockNumber = await web3.eth.getBlockNumber()
            let startTime = (await web3.eth.getBlock(blockNumber)).timestamp + 50
            let endTime = startTime + 50

            const processId = await instance.methods.getProcessId(entityAddress, 0).call()

            // Create
            const result1 = await instance.methods.create(
                defaultResolver,
                defaultProcessName,
                defaultMetadataContentUri,
                startTime,
                endTime,
                defaultEncryptionPublicKey
            ).send({
                from: entityAddress,
                nonce: await web3.eth.getTransactionCount(entityAddress)
            })

            assert.ok(result1.transactionHash)

            // Register relay
            const result2 = await instance.methods.addRelay(
                processId,
                relayAddress,
                relayPublicKey,
                relayMessagingUri
            ).send({
                from: entityAddress,
                nonce: await web3.eth.getTransactionCount(entityAddress)
            })

            assert.ok(result2)
            assert.ok(result2.events)
            assert.ok(result2.events.RelayAdded)
            assert.ok(result2.events.RelayAdded.returnValues)
            assert.equal(result2.events.RelayAdded.event, "RelayAdded")
            assert.equal(result2.events.RelayAdded.returnValues.processId, processId)
            assert.equal(result2.events.RelayAdded.returnValues.relayAddress, relayAddress)

        })
    })

    describe("should register a vote batch", () => {

        const relayPublicKey = "0x1234"
        const relayMessagingUri = `pss://${relayPublicKey}@my-test-topic`
        const batchDataContentUri = "bzz://batch-data-hash"

        it("only when a registered relay submits it", async () => {
            let blockNumber = await web3.eth.getBlockNumber()
            let startTime = (await web3.eth.getBlock(blockNumber)).timestamp + 2
            let endTime = startTime + 50

            const processId = await instance.methods.getProcessId(entityAddress, 0).call()

            // Create
            const result1 = await instance.methods.create(
                defaultResolver,
                defaultProcessName,
                defaultMetadataContentUri,
                startTime,
                endTime,
                defaultEncryptionPublicKey
            ).send({
                from: entityAddress,
                nonce: await web3.eth.getTransactionCount(entityAddress)
            })

            assert.ok(result1.transactionHash)

            // Register relay
            await instance.methods.addRelay(
                processId,
                relayAddress,
                relayPublicKey,
                relayMessagingUri
            ).send({
                from: entityAddress,
                nonce: await web3.eth.getTransactionCount(entityAddress)
            })

            // wait until startTime
            await (new Promise(resolve => setTimeout(resolve, 3 * 1000)))
            // await increaseTimestamp(2)    // Not working with ganache by now

            // Get vote batch count
            const result2 = await instance.methods.getVoteBatchCount(processId).call()
            assert.equal(result2, 0)

            // Attempt to register a batch by an unauthorized relay
            try {
                await instance.methods.registerVoteBatch(
                    processId,
                    "bzz://random-content-uri"
                ).send({
                    from: randomAddress2,   // <<--
                    nonce: await web3.eth.getTransactionCount(randomAddress2)
                })
                assert.fail("The transaction should have thrown an error but didn't")
            }
            catch (err) {
                assert(err.message.match(/revert/), "The transaction threw an unexpected error:\n" + err.message)
            }

            // Get vote batch count
            const result3 = await instance.methods.getVoteBatchCount(processId).call()
            assert.equal(result3, 0, "There should be no vote batches")

            // Register a batch from an authorized relay
            const result4 = await instance.methods.registerVoteBatch(
                processId,
                batchDataContentUri
            ).send({
                from: relayAddress,
                nonce: await web3.eth.getTransactionCount(relayAddress)
            })

            assert.ok(result4.transactionHash)

            // Get vote batch count
            const result5 = await instance.methods.getVoteBatchCount(processId).call()
            assert.equal(result5, 1, "There should be one vote batch now")

            const result6 = await instance.methods.getBatch(processId, 0).call()
            assert.equal(result6, batchDataContentUri)

        }).timeout(4000)

        it("only when the relay is active", async () => {
            let blockNumber = await web3.eth.getBlockNumber()
            let startTime = (await web3.eth.getBlock(blockNumber)).timestamp + 2
            let endTime = startTime + 50

            const processId = await instance.methods.getProcessId(entityAddress, 0).call()

            // Create
            const result1 = await instance.methods.create(
                defaultResolver,
                defaultProcessName,
                defaultMetadataContentUri,
                startTime,
                endTime,
                defaultEncryptionPublicKey
            ).send({
                from: entityAddress,
                nonce: await web3.eth.getTransactionCount(entityAddress)
            })

            assert.ok(result1.transactionHash)

            // Register relay
            await instance.methods.addRelay(
                processId,
                relayAddress,
                relayPublicKey,
                relayMessagingUri
            ).send({
                from: entityAddress,
                nonce: await web3.eth.getTransactionCount(entityAddress)
            })

            // wait until startTime
            await (new Promise(resolve => setTimeout(resolve, 2.2 * 1000)))
            // await increaseTimestamp(2.2)    // Not working with ganache by now

            // Get vote batch count
            const result2 = await instance.methods.getVoteBatchCount(processId).call()
            assert.equal(result2, 0, "There should be no vote batches")

            // Register a batch from an active relay
            const result3 = await instance.methods.registerVoteBatch(
                processId,
                batchDataContentUri
            ).send({
                from: relayAddress,
                nonce: await web3.eth.getTransactionCount(relayAddress)
            })
            assert.ok(result3.transactionHash)

            // Get vote batch count
            const result4 = await instance.methods.getVoteBatchCount(processId).call()
            assert.equal(result4, 1, "There should be one vote batch")

            // Disable the relay
            const result5 = await instance.methods.disableRelay(
                processId,
                relayAddress
            ).send({
                from: entityAddress,
                nonce: await web3.eth.getTransactionCount(entityAddress)
            })
            assert.ok(result5.transactionHash)

            // Get vote batch count
            const result6 = await instance.methods.getVoteBatchCount(processId).call()
            assert.equal(result6, 1)

            // Attempt to register a batch by an inactive relay
            try {
                await instance.methods.registerVoteBatch(
                    processId,
                    "bzz://random-content-uri"
                ).send({
                    from: relayAddress,
                    nonce: await web3.eth.getTransactionCount(relayAddress)
                })
                assert.fail("The transaction should have thrown an error but didn't")
            }
            catch (err) {
                assert(err.message.match(/revert/), "The transaction threw an unexpected error:\n" + err.message)
            }

            // Get vote batch count
            const result7 = await instance.methods.getVoteBatchCount(processId).call()
            assert.equal(result7, 1, "There should still be one vote batch")

            const result8 = await instance.methods.getBatch(processId, 0).call()
            assert.equal(result8, batchDataContentUri)

            const result9 = await instance.methods.getBatch(processId, 1).call()
            assert.equal(result9, "")

        }).timeout(4000)
        it("only when the processId exists", async () => {

            const nonExistingProcessId = "0x0123456789012345678901234567890123456789012345678901234567890123"

            try {
                // Try to register a relay
                await instance.methods.addRelay(
                    nonExistingProcessId,
                    relayAddress,
                    relayPublicKey,
                    relayMessagingUri
                ).send({
                    from: entityAddress,
                    nonce: await web3.eth.getTransactionCount(entityAddress)
                })

                assert.fail("The transaction should have thrown an error but didn't")
            }
            catch (err) {
                assert(err.message.match(/revert/), "The transaction threw an unexpected error:\n" + err.message)
            }

            // Attempt to register a vote batch on a random processId
            try {
                await instance.methods.registerVoteBatch(
                    nonExistingProcessId,
                    batchDataContentUri
                ).send({
                    from: relayAddress,
                    nonce: await web3.eth.getTransactionCount(relayAddress)
                })
                assert.fail("The transaction should have thrown an error but didn't")
            }
            catch (err) {
                assert(err.message.match(/revert/), "The transaction threw an unexpected error:\n" + err.message)
            }

            // Get vote batch count
            const result1 = await instance.methods.getVoteBatchCount(nonExistingProcessId).call()
            assert.equal(result1, 0, "There should be no vote batch")

            const result2 = await instance.methods.getBatch(nonExistingProcessId, 0).call()
            assert.equal(result2, "")

        })
        it("only when the process is not canceled", async () => {
            let blockNumber = await web3.eth.getBlockNumber()
            let startTime = (await web3.eth.getBlock(blockNumber)).timestamp + 2
            let endTime = startTime + 50

            const processId = await instance.methods.getProcessId(entityAddress, 0).call()

            // Create
            const result1 = await instance.methods.create(
                defaultResolver,
                defaultProcessName,
                defaultMetadataContentUri,
                startTime,
                endTime,
                defaultEncryptionPublicKey
            ).send({
                from: entityAddress,
                nonce: await web3.eth.getTransactionCount(entityAddress)
            })

            assert.ok(result1.transactionHash)

            // Register relay
            await instance.methods.addRelay(
                processId,
                relayAddress,
                relayPublicKey,
                relayMessagingUri
            ).send({
                from: entityAddress,
                nonce: await web3.eth.getTransactionCount(entityAddress)
            })

            // Cancel the process
            await instance.methods.cancel(processId).send({
                from: entityAddress,
                nonce: await web3.eth.getTransactionCount(entityAddress)
            })

            // Get vote batch count
            const result2 = await instance.methods.getVoteBatchCount(processId).call()
            assert.equal(result2, 0, "There should still be one vote batch")

            // wait until startTime
            await (new Promise(resolve => setTimeout(resolve, 3 * 1000)))
            // await increaseTimestamp(3)    // Not working with ganache by now

            // Get vote batch count
            const result3 = await instance.methods.getVoteBatchCount(processId).call()
            assert.equal(result3, 0, "There should be no vote batches")

            // Attempt to register a batch after canceling
            try {
                await instance.methods.registerVoteBatch(
                    processId,
                    batchDataContentUri
                ).send({
                    from: relayAddress,
                    nonce: await web3.eth.getTransactionCount(relayAddress)
                })
                assert.fail("The transaction should have thrown an error but didn't")
            }
            catch (err) {
                assert(err.message.match(/revert/), "The transaction threw an unexpected error:\n" + err.message)
            }

            // Get vote batch count
            const result4 = await instance.methods.getVoteBatchCount(processId).call()
            assert.equal(result4, 0, "There should still be one vote batch")

            const result5 = await instance.methods.getBatch(processId, 0).call()
            assert.equal(result5, "")

        }).timeout(4000)
        it("not before startTime", async () => {
            let blockNumber = await web3.eth.getBlockNumber()
            let startTime = (await web3.eth.getBlock(blockNumber)).timestamp + 50
            let endTime = startTime + 50

            const processId = await instance.methods.getProcessId(entityAddress, 0).call()

            // Create
            const result1 = await instance.methods.create(
                defaultResolver,
                defaultProcessName,
                defaultMetadataContentUri,
                startTime,
                endTime,
                defaultEncryptionPublicKey
            ).send({
                from: entityAddress,
                nonce: await web3.eth.getTransactionCount(entityAddress)
            })

            assert.ok(result1.transactionHash)

            // Register relay
            await instance.methods.addRelay(
                processId,
                relayAddress,
                relayPublicKey,
                relayMessagingUri
            ).send({
                from: entityAddress,
                nonce: await web3.eth.getTransactionCount(entityAddress)
            })

            // Get relay status
            const result2 = await instance.methods.isActiveRelay(processId, relayAddress).call()
            assert.equal(result2, true)

            // Get vote batch count
            const result3 = await instance.methods.getVoteBatchCount(processId).call()
            assert.equal(result3, 0, "There should be no vote batches")

            // Attempt to register a batch before startTime
            try {
                await instance.methods.registerVoteBatch(
                    processId,
                    batchDataContentUri
                ).send({
                    from: relayAddress,
                    nonce: await web3.eth.getTransactionCount(relayAddress)
                })
                assert.fail("The transaction should have thrown an error but didn't")
            }
            catch (err) {
                assert(err.message.match(/revert/), "The transaction threw an unexpected error:\n" + err.message)
            }

            // Get vote batch count
            const result4 = await instance.methods.getVoteBatchCount(processId).call()
            assert.equal(result4, 0, "There should still be one vote batch")

            const result5 = await instance.methods.getBatch(processId, 0).call()
            assert.equal(result5, "")

            // wait a bit more
            await (new Promise(resolve => setTimeout(resolve, 1 * 1000)))
            // await increaseTimestamp(1)    // Not working with ganache by now

            // Attempt to register a batch before startTime
            try {
                await instance.methods.registerVoteBatch(
                    processId,
                    batchDataContentUri
                ).send({
                    from: relayAddress,
                    nonce: await web3.eth.getTransactionCount(relayAddress)
                })
                assert.fail("The transaction should have thrown an error but didn't")
            }
            catch (err) {
                assert(err.message.match(/revert/), "The transaction threw an unexpected error:\n" + err.message)
            }

            // Get vote batch count
            const result6 = await instance.methods.getVoteBatchCount(processId).call()
            assert.equal(result6, 0, "There should still be one vote batch")

            const result7 = await instance.methods.getBatch(processId, 0).call()
            assert.equal(result7, "")

        })
        it("not after endTime", async () => {
            let blockNumber = await web3.eth.getBlockNumber()
            let startTime = (await web3.eth.getBlock(blockNumber)).timestamp + 2 // now + 2
            let endTime = startTime + 2  // now + 4

            const processId = await instance.methods.getProcessId(entityAddress, 0).call()

            // Create
            const result1 = await instance.methods.create(
                defaultResolver,
                defaultProcessName,
                defaultMetadataContentUri,
                startTime,
                endTime,
                defaultEncryptionPublicKey
            ).send({
                from: entityAddress,
                nonce: await web3.eth.getTransactionCount(entityAddress)
            })

            assert.ok(result1.transactionHash)

            // Register relay
            await instance.methods.addRelay(
                processId,
                relayAddress,
                relayPublicKey,
                relayMessagingUri
            ).send({
                from: entityAddress,
                nonce: await web3.eth.getTransactionCount(entityAddress)
            })

            // Get vote batch count
            const result2 = await instance.methods.getVoteBatchCount(processId).call()
            assert.equal(result2, 0, "There should be no vote batches")

            // wait until startTime
            await (new Promise(resolve => setTimeout(resolve, 2.2 * 1000)))
            // await increaseTimestamp(2.2)    // Not working with ganache by now

            // Register a successful vote batch
            await instance.methods.registerVoteBatch(
                processId,
                batchDataContentUri
            ).send({
                from: relayAddress,
                nonce: await web3.eth.getTransactionCount(relayAddress)
            })

            // Get vote batch count
            const result3 = await instance.methods.getVoteBatchCount(processId).call()
            assert.equal(result3, 1, "There should still be one vote batch")

            const result4 = await instance.methods.getBatch(processId, 0).call()
            assert.equal(result4, batchDataContentUri)

            // wait until endTime
            await (new Promise(resolve => setTimeout(resolve, 2.2 * 1000)))
            // await increaseTimestamp(2.2)    // Not working with ganache by now

            // Attempt to register a batch after endTime
            try {
                await instance.methods.registerVoteBatch(
                    processId,
                    batchDataContentUri
                ).send({
                    from: relayAddress,
                    nonce: await web3.eth.getTransactionCount(relayAddress)
                })
                assert.fail("The transaction should have thrown an error but didn't")
            }
            catch (err) {
                assert(err.message.match(/revert/), "The transaction threw an unexpected error:\n" + err.message)
            }

            // Get vote batch count
            const result5 = await instance.methods.getVoteBatchCount(processId).call()
            assert.equal(result5, 1, "There should still be one vote batch")

            const result6 = await instance.methods.getBatch(processId, 0).call()
            assert.equal(result6, batchDataContentUri)

        }).timeout(5500)
        it("should increase the voteBatchCount on success", async () => {
            let blockNumber = await web3.eth.getBlockNumber()
            let startTime = (await web3.eth.getBlock(blockNumber)).timestamp + 2
            let endTime = startTime + 50

            const processId = await instance.methods.getProcessId(entityAddress, 0).call()

            // Create
            const result1 = await instance.methods.create(
                defaultResolver,
                defaultProcessName,
                defaultMetadataContentUri,
                startTime,
                endTime,
                defaultEncryptionPublicKey
            ).send({
                from: entityAddress,
                nonce: await web3.eth.getTransactionCount(entityAddress)
            })

            assert.ok(result1.transactionHash)

            // Register relay
            await instance.methods.addRelay(
                processId,
                relayAddress,
                relayPublicKey,
                relayMessagingUri
            ).send({
                from: entityAddress,
                nonce: await web3.eth.getTransactionCount(entityAddress)
            })

            // Get vote batch count
            const result2 = await instance.methods.getVoteBatchCount(processId).call()
            assert.equal(result2, 0, "There should be no vote batches yet")

            // wait until startTime
            await (new Promise(resolve => setTimeout(resolve, 3 * 1000)))
            // await increaseTimestamp(2)    // Not working with ganache by now

            // Register a successful vote batch
            await instance.methods.registerVoteBatch(
                processId,
                batchDataContentUri
            ).send({
                from: relayAddress,
                nonce: await web3.eth.getTransactionCount(relayAddress)
            })

            // Get vote batch count
            const result3 = await instance.methods.getVoteBatchCount(processId).call()
            assert.equal(result3, 1, "There should be one vote batch")

            // Register another successful vote batch
            await instance.methods.registerVoteBatch(
                processId,
                batchDataContentUri
            ).send({
                from: relayAddress,
                nonce: await web3.eth.getTransactionCount(relayAddress)
            })

            // Get vote batch count
            const result4 = await instance.methods.getVoteBatchCount(processId).call()
            assert.equal(result4, 2, "There should be 2 vote batches")

        }).timeout(4000)

        it("should not increase the voteBatchCount on error", async () => {
            let blockNumber = await web3.eth.getBlockNumber()
            let startTime = (await web3.eth.getBlock(blockNumber)).timestamp + 2
            let endTime = startTime + 2

            const processId = await instance.methods.getProcessId(entityAddress, 0).call()

            // Create
            const result1 = await instance.methods.create(
                defaultResolver,
                defaultProcessName,
                defaultMetadataContentUri,
                startTime,
                endTime,
                defaultEncryptionPublicKey
            ).send({
                from: entityAddress,
                nonce: await web3.eth.getTransactionCount(entityAddress)
            })

            assert.ok(result1.transactionHash)

            // Register relay
            await instance.methods.addRelay(
                processId,
                relayAddress,
                relayPublicKey,
                relayMessagingUri
            ).send({
                from: entityAddress,
                nonce: await web3.eth.getTransactionCount(entityAddress)
            })

            // Get vote batch count
            const result2 = await instance.methods.getVoteBatchCount(processId).call()
            assert.equal(result2, 0, "There should be no vote batches")

            // wait until startTime
            await (new Promise(resolve => setTimeout(resolve, 2.2 * 1000)))
            // await increaseTimestamp(2.2)    // Not working with ganache by now

            // Register a successful vote batch
            await instance.methods.registerVoteBatch(
                processId,
                batchDataContentUri
            ).send({
                from: relayAddress,
                nonce: await web3.eth.getTransactionCount(relayAddress)
            })

            // Get vote batch count
            const result3 = await instance.methods.getVoteBatchCount(processId).call()
            assert.equal(result3, 1, "There should be one vote batch")

            const result4 = await instance.methods.getBatch(processId, 0).call()
            assert.equal(result4, batchDataContentUri)

            // wait until endTime
            await (new Promise(resolve => setTimeout(resolve, 2.2 * 1000)))
            // await increaseTimestamp(2.2)    // Not working with ganache by now

            // Attempt to register a batch after endTime
            try {
                await instance.methods.registerVoteBatch(
                    processId,
                    batchDataContentUri
                ).send({
                    from: relayAddress,
                    nonce: await web3.eth.getTransactionCount(relayAddress)
                })
                assert.fail("The transaction should have thrown an error but didn't")
            }
            catch (err) {
                assert(err.message.match(/revert/), "The transaction threw an unexpected error:\n" + err.message)
            }

            // Get vote batch count
            const result5 = await instance.methods.getVoteBatchCount(processId).call()
            assert.equal(result5, 1, "There should still be one vote batch")

            const result6 = await instance.methods.getBatch(processId, 0).call()
            assert.equal(result6, batchDataContentUri)

            // Attempt to register a batch by someone else
            try {
                await instance.methods.registerVoteBatch(
                    processId,
                    batchDataContentUri
                ).send({
                    from: randomAddress1,
                    nonce: await web3.eth.getTransactionCount(randomAddress1)
                })
                assert.fail("The transaction should have thrown an error but didn't")
            }
            catch (err) {
                assert(err.message.match(/revert/), "The transaction threw an unexpected error:\n" + err.message)
            }

            // Get vote batch count
            const result7 = await instance.methods.getVoteBatchCount(processId).call()
            assert.equal(result7, 1, "There should still be one vote batch")

            const result8 = await instance.methods.getBatch(processId, 0).call()
            assert.equal(result8, batchDataContentUri)

            // Disable relay
            const result9 = await instance.methods.disableRelay(
                processId,
                relayAddress
            ).send({
                from: entityAddress,
                nonce: await web3.eth.getTransactionCount(entityAddress)
            })
            assert.ok(result9.transactionHash)

            // Attempt to register a batch after disabling
            try {
                await instance.methods.registerVoteBatch(
                    processId,
                    batchDataContentUri
                ).send({
                    from: relayAddress,
                    nonce: await web3.eth.getTransactionCount(relayAddress)
                })
                assert.fail("The transaction should have thrown an error but didn't")
            }
            catch (err) {
                assert(err.message.match(/revert/), "The transaction threw an unexpected error:\n" + err.message)
            }

            // Get vote batch count
            const result10 = await instance.methods.getVoteBatchCount(processId).call()
            assert.equal(result10, 1, "There should still be one vote batch")

            const result11 = await instance.methods.getBatch(processId, 0).call()
            assert.equal(result11, batchDataContentUri)

        }).timeout(5500)

        it("should retrieve the vote batches submitted in ascending order", async () => {
            let blockNumber = await web3.eth.getBlockNumber()
            let startTime = (await web3.eth.getBlock(blockNumber)).timestamp + 2
            let endTime = startTime + 50

            const processId = await instance.methods.getProcessId(entityAddress, 0).call()

            // Create
            const result1 = await instance.methods.create(
                defaultResolver,
                defaultProcessName,
                defaultMetadataContentUri,
                startTime,
                endTime,
                defaultEncryptionPublicKey
            ).send({
                from: entityAddress,
                nonce: await web3.eth.getTransactionCount(entityAddress)
            })
            assert.ok(result1.transactionHash)

            // Register relay
            await instance.methods.addRelay(
                processId,
                relayAddress,
                relayPublicKey,
                relayMessagingUri
            ).send({
                from: entityAddress,
                nonce: await web3.eth.getTransactionCount(entityAddress)
            })

            // Get vote batch count
            const result2 = await instance.methods.getVoteBatchCount(processId).call()
            assert.equal(result2, 0, "There should be no vote batches yet")

            // wait until startTime
            await (new Promise(resolve => setTimeout(resolve, 3 * 1000)))
            // await increaseTimestamp(2)    // Not working with ganache by now

            // Register successful vote batches
            await instance.methods.registerVoteBatch(processId, batchDataContentUri + "-1").send({
                from: relayAddress,
                nonce: await web3.eth.getTransactionCount(relayAddress)
            })

            await instance.methods.registerVoteBatch(processId, batchDataContentUri + "-2").send({
                from: relayAddress,
                nonce: await web3.eth.getTransactionCount(relayAddress)
            })

            await instance.methods.registerVoteBatch(processId, batchDataContentUri + "-3").send({
                from: relayAddress,
                nonce: await web3.eth.getTransactionCount(relayAddress)
            })

            await instance.methods.registerVoteBatch(processId, batchDataContentUri + "-4").send({
                from: relayAddress,
                nonce: await web3.eth.getTransactionCount(relayAddress)
            })

            // Get vote batch count
            const result3 = await instance.methods.getVoteBatchCount(processId).call()
            assert.equal(result3, 4, "There should be 4 vote batches")

            const result4 = await instance.methods.getBatch(processId, 0).call()
            assert.equal(result4, batchDataContentUri + "-1")

            const result5 = await instance.methods.getBatch(processId, 1).call()
            assert.equal(result5, batchDataContentUri + "-2")

            const result6 = await instance.methods.getBatch(processId, 2).call()
            assert.equal(result6, batchDataContentUri + "-3")

            const result7 = await instance.methods.getBatch(processId, 3).call()
            assert.equal(result7, batchDataContentUri + "-4")

        }).timeout(5000)

        it("should emit an event", async () => {
            let blockNumber = await web3.eth.getBlockNumber()
            let startTime = (await web3.eth.getBlock(blockNumber)).timestamp + 2
            let endTime = startTime + 50

            const processId = await instance.methods.getProcessId(entityAddress, 0).call()

            // Create
            const result1 = await instance.methods.create(
                defaultResolver,
                defaultProcessName,
                defaultMetadataContentUri,
                startTime,
                endTime,
                defaultEncryptionPublicKey
            ).send({
                from: entityAddress,
                nonce: await web3.eth.getTransactionCount(entityAddress)
            })
            assert.ok(result1.transactionHash)

            // Register relay
            await instance.methods.addRelay(
                processId,
                relayAddress,
                relayPublicKey,
                relayMessagingUri
            ).send({
                from: entityAddress,
                nonce: await web3.eth.getTransactionCount(entityAddress)
            })

            // Get vote batch count
            const result2 = await instance.methods.getVoteBatchCount(processId).call()
            assert.equal(result2, 0, "There should be no vote batches yet")

            // wait until startTime
            await (new Promise(resolve => setTimeout(resolve, 2.2 * 1000)))
            // await increaseTimestamp(2.2)    // Not working with ganache by now

            // Register a successful vote batch
            const result3 = await instance.methods.registerVoteBatch(processId, batchDataContentUri).send({
                from: relayAddress,
                nonce: await web3.eth.getTransactionCount(relayAddress)
            })

            assert.ok(result3)
            assert.ok(result3.events)
            assert.ok(result3.events.BatchRegistered)
            assert.ok(result3.events.BatchRegistered.returnValues)
            assert.equal(result3.events.BatchRegistered.event, "BatchRegistered")
            assert.equal(result3.events.BatchRegistered.returnValues.processId, processId)
            assert.equal(result3.events.BatchRegistered.returnValues.batchNumber, 0)

        }).timeout(3000)
    })

    describe("should disable a relay", () => {

        const relayPublicKey = "0x1234"
        const relayMessagingUri = `pss://${relayPublicKey}@my-test-topic`

        it("only when the creator requests it", async () => {
            let blockNumber = await web3.eth.getBlockNumber()
            let startTime = (await web3.eth.getBlock(blockNumber)).timestamp + 50
            let endTime = startTime + 50

            const processId = await instance.methods.getProcessId(entityAddress, 0).call()

            // Create
            const result1 = await instance.methods.create(
                defaultResolver,
                defaultProcessName,
                defaultMetadataContentUri,
                startTime,
                endTime,
                defaultEncryptionPublicKey
            ).send({
                from: entityAddress,
                nonce: await web3.eth.getTransactionCount(entityAddress)
            })

            assert.ok(result1.transactionHash)

            // Register relay
            await instance.methods.addRelay(
                processId,
                relayAddress,
                relayPublicKey,
                relayMessagingUri
            ).send({
                from: entityAddress,
                nonce: await web3.eth.getTransactionCount(entityAddress)
            })

            // Attempt to disable the relay from someone else
            try {
                await instance.methods.disableRelay(
                    processId,
                    relayAddress
                ).send({
                    from: randomAddress1,   // <<--
                    nonce: await web3.eth.getTransactionCount(randomAddress1)
                })
                assert.fail("The transaction should have thrown an error but didn't")
            }
            catch (err) {
                assert(err.message.match(/revert/), "The transaction threw an unexpected error:\n" + err.message)
            }

            // Get relay list
            const result2 = await instance.methods.getRelayIndex(processId).call()
            assert.equal(result2.length, 1)
            assert.deepEqual(result2, [relayAddress])

            // Disable relay from the creator
            const result3 = await instance.methods.disableRelay(
                processId,
                relayAddress
            ).send({
                from: entityAddress,
                nonce: await web3.eth.getTransactionCount(entityAddress)
            })

            // Get relay list
            const result4 = await instance.methods.getRelayIndex(processId).call()
            assert.equal(result4.length, 0)
            assert.deepEqual(result4, [])

        })
        it("only when the processId exists", async () => {

            const nonExistingProcessId = "0x0123456789012345678901234567890123456789012345678901234567890123"

            // Attempt to disable a relay from a random processId
            try {
                await instance.methods.disableRelay(
                    nonExistingProcessId,
                    randomAddress2
                ).send({
                    from: entityAddress,
                    nonce: await web3.eth.getTransactionCount(entityAddress)
                })

                assert.fail("The transaction should have thrown an error but didn't")
            }
            catch (err) {
                assert(err.message.match(/revert/), "The transaction threw an unexpected error:\n" + err.message)
            }

            // Get relay list
            const result4 = await instance.methods.getRelayIndex(nonExistingProcessId).call()
            assert.equal(result4.length, 0)
            assert.deepEqual(result4, [])

        })
        it("only when the process is not canceled", async () => {
            let blockNumber = await web3.eth.getBlockNumber()
            let startTime = (await web3.eth.getBlock(blockNumber)).timestamp + 50
            let endTime = startTime + 50

            const processId = await instance.methods.getProcessId(entityAddress, 0).call()

            // Create
            const result1 = await instance.methods.create(
                defaultResolver,
                defaultProcessName,
                defaultMetadataContentUri,
                startTime,
                endTime,
                defaultEncryptionPublicKey
            ).send({
                from: entityAddress,
                nonce: await web3.eth.getTransactionCount(entityAddress)
            })

            assert.equal(result1.events.ProcessCreated.returnValues.processId, processId)

            // Register a relay
            const result2 = await instance.methods.addRelay(
                processId,
                relayAddress,
                relayPublicKey,
                relayMessagingUri
            ).send({
                from: entityAddress,
                nonce: await web3.eth.getTransactionCount(entityAddress)
            })

            assert.ok(result2.transactionHash)

            // Canceled by the creator
            const result3 = await instance.methods.cancel(processId).send({
                from: entityAddress,
                nonce: await web3.eth.getTransactionCount(entityAddress)
            })

            assert.equal(result3.events.ProcessCanceled.returnValues.processId, processId)

            // Attempt to disable a relay after being canceled
            try {
                await instance.methods.disableRelay(
                    processId,
                    relayAddress
                ).send({
                    from: entityAddress,
                    nonce: await web3.eth.getTransactionCount(entityAddress)
                })

                assert.fail("The transaction should have thrown an error but didn't")
            }
            catch (err) {
                assert(err.message.match(/revert/), "The transaction threw an unexpected error:\n" + err.message)
            }

            // Get relay list
            const result4 = await instance.methods.getRelayIndex(processId).call()
            assert.equal(result4.length, 0)
            assert.deepEqual(result4, [])

        })
        it("should fail if the relay does not exist", async () => {
            let blockNumber = await web3.eth.getBlockNumber()
            let startTime = (await web3.eth.getBlock(blockNumber)).timestamp + 50
            let endTime = startTime + 50

            const processId = await instance.methods.getProcessId(entityAddress, 0).call()

            // Create
            const result1 = await instance.methods.create(
                defaultResolver,
                defaultProcessName,
                defaultMetadataContentUri,
                startTime,
                endTime,
                defaultEncryptionPublicKey
            ).send({
                from: entityAddress,
                nonce: await web3.eth.getTransactionCount(entityAddress)
            })

            assert.equal(result1.events.ProcessCreated.returnValues.processId, processId)

            // Register a relay
            const result2 = await instance.methods.addRelay(
                processId,
                relayAddress,
                relayPublicKey,
                relayMessagingUri
            ).send({
                from: entityAddress,
                nonce: await web3.eth.getTransactionCount(entityAddress)
            })

            assert.ok(result2.transactionHash)

            // Attempt to disable non-existing relay
            try {
                await instance.methods.disableRelay(
                    processId,
                    randomAddress2   // <<--
                ).send({
                    from: entityAddress,
                    nonce: await web3.eth.getTransactionCount(entityAddress)
                })

                assert.fail("The transaction should have thrown an error but didn't")
            }
            catch (err) {
                assert(err.message.match(/revert/), "The transaction threw an unexpected error:\n" + err.message)
            }

            // Get relay list
            const result4 = await instance.methods.getRelayIndex(processId).call()
            assert.equal(result4.length, 1)
            assert.deepEqual(result4, [relayAddress])

        })
        it("should remove the relay address from the relay list", async () => {
            let blockNumber = await web3.eth.getBlockNumber()
            let startTime = (await web3.eth.getBlock(blockNumber)).timestamp + 50
            let endTime = startTime + 50

            const processId = await instance.methods.getProcessId(entityAddress, 0).call()

            // Create
            const result1 = await instance.methods.create(
                defaultResolver,
                defaultProcessName,
                defaultMetadataContentUri,
                startTime,
                endTime,
                defaultEncryptionPublicKey
            ).send({
                from: entityAddress,
                nonce: await web3.eth.getTransactionCount(entityAddress)
            })

            assert.equal(result1.events.ProcessCreated.returnValues.processId, processId)

            // Register relay #1
            const result2 = await instance.methods.addRelay(
                processId,
                relayAddress,
                relayPublicKey,
                relayMessagingUri
            ).send({
                from: entityAddress,
                nonce: await web3.eth.getTransactionCount(entityAddress)
            })

            assert.ok(result2.transactionHash)

            // Register relay #2
            const result3 = await instance.methods.addRelay(
                processId,
                randomAddress1,
                relayPublicKey,
                relayMessagingUri
            ).send({
                from: entityAddress,
                nonce: await web3.eth.getTransactionCount(entityAddress)
            })

            assert.ok(result3.transactionHash)

            // Get relay list
            const result4 = await instance.methods.getRelayIndex(processId).call()
            assert.equal(result4.length, 2)
            assert.deepEqual(result4, [relayAddress, randomAddress1])

            // Disable relay #1
            await instance.methods.disableRelay(
                processId,
                randomAddress1
            ).send({
                from: entityAddress,
                nonce: await web3.eth.getTransactionCount(entityAddress)
            })

            // Get relay list
            const result5 = await instance.methods.getRelayIndex(processId).call()
            assert.equal(result5.length, 1)
            assert.deepEqual(result5, [relayAddress])

        })
        it("should return false on isActiveRelay", async () => {
            let blockNumber = await web3.eth.getBlockNumber()
            let startTime = (await web3.eth.getBlock(blockNumber)).timestamp + 50
            let endTime = startTime + 50

            const processId = await instance.methods.getProcessId(entityAddress, 0).call()

            // Create
            const result1 = await instance.methods.create(
                defaultResolver,
                defaultProcessName,
                defaultMetadataContentUri,
                startTime,
                endTime,
                defaultEncryptionPublicKey
            ).send({
                from: entityAddress,
                nonce: await web3.eth.getTransactionCount(entityAddress)
            })

            assert.equal(result1.events.ProcessCreated.returnValues.processId, processId)

            // Register relay
            const result2 = await instance.methods.addRelay(
                processId,
                relayAddress,
                relayPublicKey,
                relayMessagingUri
            ).send({
                from: entityAddress,
                nonce: await web3.eth.getTransactionCount(entityAddress)
            })

            assert.ok(result2.transactionHash)

            // Get relay status
            const result3 = await instance.methods.isActiveRelay(processId, relayAddress).call()
            assert.equal(result3, true)

            // Disable relay
            await instance.methods.disableRelay(
                processId,
                relayAddress
            ).send({
                from: entityAddress,
                nonce: await web3.eth.getTransactionCount(entityAddress)
            })

            // Get relay status
            const result4 = await instance.methods.isActiveRelay(processId, relayAddress).call()
            assert.equal(result4, false)

        })
        it("should fail to register new vote batches from a disabled relay", async () => {
            // Note: this probably duplicated another testcase functionality
            // Keeping it here too for consistence purposes
            let blockNumber = await web3.eth.getBlockNumber()
            let startTime = (await web3.eth.getBlock(blockNumber)).timestamp + 2
            let endTime = startTime + 50
            const batchDataContentUri = "bzz://content-hash-here"

            const processId = await instance.methods.getProcessId(entityAddress, 0).call()

            // Create
            const result1 = await instance.methods.create(
                defaultResolver,
                defaultProcessName,
                defaultMetadataContentUri,
                startTime,
                endTime,
                defaultEncryptionPublicKey
            ).send({
                from: entityAddress,
                nonce: await web3.eth.getTransactionCount(entityAddress)
            })

            assert.ok(result1.transactionHash)

            // Register relay
            await instance.methods.addRelay(
                processId,
                relayAddress,
                relayPublicKey,
                relayMessagingUri
            ).send({
                from: entityAddress,
                nonce: await web3.eth.getTransactionCount(entityAddress)
            })

            // wait until startTime
            await (new Promise(resolve => setTimeout(resolve, 2.2 * 1000)))
            // await increaseTimestamp(2.2)    // Not working with ganache by now

            // Get vote batch count
            const result2 = await instance.methods.getVoteBatchCount(processId).call()
            assert.equal(result2, 0, "There should be no vote batches")

            // Register a batch from an active relay
            const result3 = await instance.methods.registerVoteBatch(
                processId,
                batchDataContentUri
            ).send({
                from: relayAddress,
                nonce: await web3.eth.getTransactionCount(relayAddress)
            })
            assert.ok(result3.transactionHash)

            // Get vote batch count
            const result4 = await instance.methods.getVoteBatchCount(processId).call()
            assert.equal(result4, 1, "There should be one vote batch")

            // Disable the relay
            const result5 = await instance.methods.disableRelay(
                processId,
                relayAddress
            ).send({
                from: entityAddress,
                nonce: await web3.eth.getTransactionCount(entityAddress)
            })
            assert.ok(result5.transactionHash)

            // Get vote batch count
            const result6 = await instance.methods.getVoteBatchCount(processId).call()
            assert.equal(result6, 1)

            // Attempt to register a batch by an inactive relay
            try {
                await instance.methods.registerVoteBatch(
                    processId,
                    "bzz://random-content-uri"
                ).send({
                    from: relayAddress,
                    nonce: await web3.eth.getTransactionCount(relayAddress)
                })
                assert.fail("The transaction should have thrown an error but didn't")
            }
            catch (err) {
                assert(err.message.match(/revert/), "The transaction threw an unexpected error:\n" + err.message)
            }

            // Get vote batch count
            const result7 = await instance.methods.getVoteBatchCount(processId).call()
            assert.equal(result7, 1, "There should still be one vote batch")

            const result8 = await instance.methods.getBatch(processId, 0).call()
            assert.equal(result8, batchDataContentUri)

            const result9 = await instance.methods.getBatch(processId, 1).call()
            assert.equal(result9, "")

        }).timeout(3000)

        it("should emit an event", async () => {
            let blockNumber = await web3.eth.getBlockNumber()
            let startTime = (await web3.eth.getBlock(blockNumber)).timestamp + 50
            let endTime = startTime + 50

            const processId = await instance.methods.getProcessId(entityAddress, 0).call()

            // Create
            const result1 = await instance.methods.create(
                defaultResolver,
                defaultProcessName,
                defaultMetadataContentUri,
                startTime,
                endTime,
                defaultEncryptionPublicKey
            ).send({
                from: entityAddress,
                nonce: await web3.eth.getTransactionCount(entityAddress)
            })

            assert.ok(result1.transactionHash)

            // Register relay
            await instance.methods.addRelay(
                processId,
                relayAddress,
                relayPublicKey,
                relayMessagingUri
            ).send({
                from: entityAddress,
                nonce: await web3.eth.getTransactionCount(entityAddress)
            })

            // Disable relay
            const result3 = await instance.methods.disableRelay(
                processId,
                relayAddress
            ).send({
                from: entityAddress,
                nonce: await web3.eth.getTransactionCount(entityAddress)
            })

            assert.ok(result3)
            assert.ok(result3.events)
            assert.ok(result3.events.RelayDisabled)
            assert.ok(result3.events.RelayDisabled.returnValues)
            assert.equal(result3.events.RelayDisabled.event, "RelayDisabled")
            assert.equal(result3.events.RelayDisabled.returnValues.processId, processId)
            assert.equal(result3.events.RelayDisabled.returnValues.relayAddress, relayAddress)

        })
    })

    describe("should accept the encryption private key", () => {

        const relayPublicKey = "0x1234"
        const relayMessagingUri = `pss://${relayPublicKey}@my-test-topic`
        const batchDataContentUri = "bzz://batch-data-hash"
        const privateKey = "0x01234567890"

        it("only when the creator requests it", async () => {
            let blockNumber = await web3.eth.getBlockNumber()
            let startTime = (await web3.eth.getBlock(blockNumber)).timestamp + 2  // NOW + 2
            let endTime = startTime + 2  // NOW + 4
            const batchDataContentUri = "bzz://content-hash-here"

            const processId = await instance.methods.getProcessId(entityAddress, 0).call()

            // Create
            const result1 = await instance.methods.create(
                defaultResolver,
                defaultProcessName,
                defaultMetadataContentUri,
                startTime,
                endTime,
                defaultEncryptionPublicKey
            ).send({
                from: entityAddress,
                nonce: await web3.eth.getTransactionCount(entityAddress)
            })

            assert.ok(result1.transactionHash)

            // Register relay
            await instance.methods.addRelay(
                processId,
                relayAddress,
                relayPublicKey,
                relayMessagingUri
            ).send({
                from: entityAddress,
                nonce: await web3.eth.getTransactionCount(entityAddress)
            })

            // wait until startTime
            await (new Promise(resolve => setTimeout(resolve, 2.5 * 1000)))
            // await increaseTimestamp(2.5)    // Not working with ganache by now

            // Register a batch from an active relay
            await instance.methods.registerVoteBatch(
                processId,
                batchDataContentUri
            ).send({
                from: relayAddress,
                nonce: await web3.eth.getTransactionCount(relayAddress)
            })

            // wait until endTime
            await (new Promise(resolve => setTimeout(resolve, 2.2 * 1000)))
            // await increaseTimestamp(2.2)    // Not working with ganache by now

            // Attempt to reveal the private key by someone else
            try {
                await instance.methods.revealPrivateKey(processId, privateKey).send({
                    from: randomAddress1,
                    nonce: await web3.eth.getTransactionCount(randomAddress1)
                })
                assert.fail("The transaction should have thrown an error but didn't")
            }
            catch (err) {
                assert(err.message.match(/revert/), "The transaction threw an unexpected error:\n" + err.message)
            }

            // Get private key
            const result2 = await instance.methods.getPrivateKey(processId).call()
            assert.equal(result2, "", "There should be no private key")

            // Reveal the private key
            await instance.methods.revealPrivateKey(processId, privateKey).send({
                from: entityAddress,
                nonce: await web3.eth.getTransactionCount(entityAddress)
            })

            // Get private key
            const result3 = await instance.methods.getPrivateKey(processId).call()
            assert.equal(result3, privateKey, "The private key should match")

        }).timeout(6000)
        it("only when the processId exists", async () => {
            const nonExistingProcessId = "0x0123456789012345678901234567890123456789012345678901234567890123"

            // Attempt to reveal the key of a random processId
            try {
                // Reveal the private key
                await instance.methods.revealPrivateKey(nonExistingProcessId, privateKey).send({
                    from: entityAddress,
                    nonce: await web3.eth.getTransactionCount(entityAddress)
                })

                assert.fail("The transaction should have thrown an error but didn't")
            }
            catch (err) {
                assert(err.message.match(/revert/), "The transaction threw an unexpected error:\n" + err.message)
            }

            // Get private key
            const result2 = await instance.methods.getPrivateKey(nonExistingProcessId).call()
            assert.equal(result2, "", "There should be no private key")

        })
        it("only when the process is not canceled", async () => {
            let blockNumber = await web3.eth.getBlockNumber()
            let startTime = (await web3.eth.getBlock(blockNumber)).timestamp + 2  // NOW + 2
            let endTime = startTime + 1  // NOW + 3

            const processId = await instance.methods.getProcessId(entityAddress, 0).call()

            // Create
            const result1 = await instance.methods.create(
                defaultResolver,
                defaultProcessName,
                defaultMetadataContentUri,
                startTime,
                endTime,
                defaultEncryptionPublicKey
            ).send({
                from: entityAddress,
                nonce: await web3.eth.getTransactionCount(entityAddress)
            })
            assert.ok(result1.transactionHash)

            // Cancel the process
            const result2 = await instance.methods.cancel(processId).send({
                from: entityAddress,
                nonce: await web3.eth.getTransactionCount(entityAddress)
            })
            assert.ok(result2.transactionHash)

            // wait until endTime
            await (new Promise(resolve => setTimeout(resolve, 4 * 1000)))
            // await increaseTimestamp(4)    // Not working with ganache by now

            // Attempt to reveal the private key after canceling
            try {
                await instance.methods.revealPrivateKey(processId, privateKey).send({
                    from: entityAddress,
                    nonce: await web3.eth.getTransactionCount(entityAddress)
                })
                assert.fail("The transaction should have thrown an error but didn't")
            }
            catch (err) {
                assert(err.message.match(/revert/), "The transaction threw an unexpected error:\n" + err.message)
            }

            // Get private key
            const result3 = await instance.methods.getPrivateKey(processId).call()
            assert.equal(result3, "", "There should be no private key")

        }).timeout(5000)
        it("only after endTime", async () => {
            let blockNumber = await web3.eth.getBlockNumber()
            let startTime = (await web3.eth.getBlock(blockNumber)).timestamp + 2  // NOW + 2
            let endTime = startTime + 2  // NOW + 4

            const processId = await instance.methods.getProcessId(entityAddress, 0).call()

            // Create
            const result1 = await instance.methods.create(
                defaultResolver,
                defaultProcessName,
                defaultMetadataContentUri,
                startTime,
                endTime,
                defaultEncryptionPublicKey
            ).send({
                from: entityAddress,
                nonce: await web3.eth.getTransactionCount(entityAddress)
            })
            assert.ok(result1.transactionHash)

            // Attempt to reveal the private key before the process starts
            try {
                await instance.methods.revealPrivateKey(processId, privateKey).send({
                    from: entityAddress,
                    nonce: await web3.eth.getTransactionCount(entityAddress)
                })
                assert.fail("The transaction should have thrown an error but didn't")
            }
            catch (err) {
                assert(err.message.match(/revert/), "The transaction threw an unexpected error:\n" + err.message)
            }

            // Get private key
            const result2 = await instance.methods.getPrivateKey(processId).call()
            assert.equal(result2, "", "There should be no private key")

            // wait until startTime and before endTime
            await (new Promise(resolve => setTimeout(resolve, 2.2 * 1000)))
            // await increaseTimestamp(2.2)    // Not working with ganache by now

            // Register relay
            await instance.methods.addRelay(
                processId,
                relayAddress,
                relayPublicKey,
                relayMessagingUri
            ).send({
                from: entityAddress,
                nonce: await web3.eth.getTransactionCount(entityAddress)
            })

            // Register a batch from an active relay
            await instance.methods.registerVoteBatch(processId, batchDataContentUri).send({
                from: relayAddress,
                nonce: await web3.eth.getTransactionCount(relayAddress)
            })

            // Attempt to reveal the private key
            try {
                await instance.methods.revealPrivateKey(processId, privateKey).send({
                    from: entityAddress,
                    nonce: await web3.eth.getTransactionCount(entityAddress)
                })
                assert.fail("The transaction should have thrown an error but didn't")
            }
            catch (err) {
                assert(err.message.match(/revert/), "The transaction threw an unexpected error:\n" + err.message)
            }

            // Get private key
            const result3 = await instance.methods.getPrivateKey(processId).call()
            assert.equal(result3, "", "There should be no private key")

        }).timeout(6000)
        it("should retrieve the submited private key", async () => {
            let blockNumber = await web3.eth.getBlockNumber()
            let startTime = (await web3.eth.getBlock(blockNumber)).timestamp + 2  // NOW + 2
            let endTime = startTime + 1  // NOW + 3

            const processId = await instance.methods.getProcessId(entityAddress, 0).call()

            // Create
            const result1 = await instance.methods.create(
                defaultResolver,
                defaultProcessName,
                defaultMetadataContentUri,
                startTime,
                endTime,
                defaultEncryptionPublicKey
            ).send({
                from: entityAddress,
                nonce: await web3.eth.getTransactionCount(entityAddress)
            })
            assert.ok(result1.transactionHash)

            // Register relay
            await instance.methods.addRelay(
                processId,
                relayAddress,
                relayPublicKey,
                relayMessagingUri
            ).send({
                from: entityAddress,
                nonce: await web3.eth.getTransactionCount(entityAddress)
            })

            // wait until endTime
            await (new Promise(resolve => setTimeout(resolve, 4 * 1000)))
            // await increaseTimestamp(4)    // Not working with ganache by now

            // Reveal the private key
            await instance.methods.revealPrivateKey(processId, privateKey).send({
                from: entityAddress,
                nonce: await web3.eth.getTransactionCount(entityAddress)
            })

            // Get private key
            const result2 = await instance.methods.getPrivateKey(processId).call()
            assert.equal(result2, privateKey, "The private key should match")

        }).timeout(5000)

        // TODO: replace T+1 when the implementation is available
        it("only if the key matches the public key registered")
        it("should overwrite it in case of a mistake", async () => {
            let blockNumber = await web3.eth.getBlockNumber()
            let startTime = (await web3.eth.getBlock(blockNumber)).timestamp + 2  // NOW + 2
            let endTime = startTime + 1  // NOW + 3

            const processId = await instance.methods.getProcessId(entityAddress, 0).call()

            // Create
            const result1 = await instance.methods.create(
                defaultResolver,
                defaultProcessName,
                defaultMetadataContentUri,
                startTime,
                endTime,
                defaultEncryptionPublicKey
            ).send({
                from: entityAddress,
                nonce: await web3.eth.getTransactionCount(entityAddress)
            })
            assert.ok(result1.transactionHash)

            // Register relay
            await instance.methods.addRelay(
                processId,
                relayAddress,
                relayPublicKey,
                relayMessagingUri
            ).send({
                from: entityAddress,
                nonce: await web3.eth.getTransactionCount(entityAddress)
            })

            // wait until endTime
            await (new Promise(resolve => setTimeout(resolve, 4 * 1000)))
            // await increaseTimestamp(4)    // Not working with ganache by now

            // Reveal the wrong private key
            await instance.methods.revealPrivateKey(processId, "INVALID_PRIVATE_KEY").send({
                from: entityAddress,
                nonce: await web3.eth.getTransactionCount(entityAddress)
            })

            // Get private key
            const result2 = await instance.methods.getPrivateKey(processId).call()
            assert.equal(result2, "INVALID_PRIVATE_KEY", "The private key should match the invalid one")

            // Update the private key
            await instance.methods.revealPrivateKey(processId, privateKey).send({
                from: entityAddress,
                nonce: await web3.eth.getTransactionCount(entityAddress)
            })

            // Get private key
            const result3 = await instance.methods.getPrivateKey(processId).call()
            assert.equal(result3, privateKey, "The private key should match")

        }).timeout(5000)
        it("should emit an event", async () => {
            let blockNumber = await web3.eth.getBlockNumber()
            let startTime = (await web3.eth.getBlock(blockNumber)).timestamp + 2  // NOW + 2
            let endTime = startTime + 1  // NOW + 3

            const processId = await instance.methods.getProcessId(entityAddress, 0).call()

            // Create
            const result1 = await instance.methods.create(
                defaultResolver,
                defaultProcessName,
                defaultMetadataContentUri,
                startTime,
                endTime,
                defaultEncryptionPublicKey
            ).send({
                from: entityAddress,
                nonce: await web3.eth.getTransactionCount(entityAddress)
            })
            assert.ok(result1.transactionHash)

            // wait until endTime
            await (new Promise(resolve => setTimeout(resolve, 4 * 1000)))
            // await increaseTimestamp(4)    // Not working with ganache by now

            // Reveal the wrong private key
            const result2 = await instance.methods.revealPrivateKey(processId, privateKey).send({
                from: entityAddress,
                nonce: await web3.eth.getTransactionCount(entityAddress)
            })

            assert.ok(result2)
            assert.ok(result2.events)
            assert.ok(result2.events.PrivateKeyRevealed)
            assert.ok(result2.events.PrivateKeyRevealed.returnValues)
            assert.equal(result2.events.PrivateKeyRevealed.event, "PrivateKeyRevealed")
            assert.equal(result2.events.PrivateKeyRevealed.returnValues.processId, processId)
            assert.equal(result2.events.PrivateKeyRevealed.returnValues.privateKey, privateKey)
        }).timeout(5000)
    })
*/
})
