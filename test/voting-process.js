const assert = require("assert")
const { getWeb3, increaseTimestamp, deployVotingProcess } = require("../lib/util")

const web3 = getWeb3()

let accounts
let instance

let entityAddress, relayAddress, randomAddress1, randomAddress2

const defaultResolver = "0x1234567890123456789012345678901234567890"
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

        instance = await deployVotingProcess()
    })

    it("should deploy the contract", async () => {
        const localInstance = await deployVotingProcess()

        assert.ok(localInstance)
        assert.ok(localInstance.options)
        assert.ok(localInstance.options.address.match(/^0x[0-9a-fA-F]{40}$/))
    })

    it("should compute a process ID from the entity address and the process index", async () => {
        assert(instance.methods.getProcessId)
        assert(instance.methods.getProcessId.call)

        const proc1 = await instance.methods.getProcessId(accounts[0], 0).call()
        const proc2 = await instance.methods.getProcessId(accounts[0], 0).call()
        const proc3 = await instance.methods.getProcessId(accounts[0], 1).call()
        const proc4 = await instance.methods.getProcessId(accounts[0], 1).call()
        const proc5 = await instance.methods.getProcessId(accounts[0], 2).call()
        const proc6 = await instance.methods.getProcessId(accounts[0], 3).call()

        assert.equal(proc1, proc2)
        assert.equal(proc3, proc4)

        assert.notEqual(proc1, proc3)
        assert.notEqual(proc1, proc5)
        assert.notEqual(proc1, proc6)

        assert.notEqual(proc3, proc5)
        assert.notEqual(proc3, proc6)

        assert.notEqual(proc5, proc6)
    })

    it("should compute the next process ID", async () => {
        assert(instance.methods.getNextProcessId)
        assert(instance.methods.getNextProcessId.call)

        // The entity has 0 processes at the moment
        // So the next process index is 0
        const processId1Expected = await instance.methods.getProcessId(entityAddress, 0).call()
        const processId1Actual = await instance.methods.getNextProcessId(entityAddress).call()

        assert.equal(processId1Expected, processId1Actual)

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

        // The entity has 1 process now
        // So the next process index is 1
        const processId2Expected = await instance.methods.getProcessId(entityAddress, 1).call()
        const processId2Actual = await instance.methods.getNextProcessId(entityAddress).call()

        assert.notEqual(processId1Actual, processId2Actual)
        assert.equal(processId2Expected, processId2Actual)
    })

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
                assert(err.message.match(/revert/), "The transaction should be reverted but threw a different error:\n" + err.message)
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
                assert(err.message.match(/revert/), "The transaction should be reverted but threw a different error:\n" + err.message)
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
                assert(err.message.match(/revert/), "The transaction should be reverted but threw a different error:\n" + err.message)
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
                assert(err.message.match(/revert/), "The transaction should be reverted but threw a different error:\n" + err.message)
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
                assert(err.message.match(/revert/), "The transaction should be reverted but threw a different error:\n" + err.message)
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
                assert(err.message.match(/revert/), "The transaction should be reverted but threw a different error:\n" + err.message)
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
                assert(err.message.match(/revert/), "The transaction should be reverted but threw a different error:\n" + err.message)
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
    })

    describe("should register a relay", () => {
        it("only when the creator requests it")
        it("only when the process ID exists")
        it("only when the process is not canceled")
        it("should fail if it already exists")
        it("should add the relay address to the relay list")
        it("should return true on isActiveRelay")
    })

    describe("should register a vote batch", () => {
        it("only when a registered relay submits it")
        it("only when the relay is active")
        it("only when the process ID exists")
        it("only when the process is not canceled")
        it("not before startTime")
        it("not after endTime")
        it("should increase the voteBatchCount on success")
        it("should not increase the voteBatchCount on error")
    })

    describe("should disable a relay", () => {
        it("only when the creator requests it")
        it("only when the process ID exists")
        it("only when the process is not canceled")
        it("should fail if it does not exist")
        it("should remove the relay address from the relay list")
        it("should return false on isActiveRelay")
        it("should fail to register new vote batches from a disabled relay")
    })

    describe("should accept the encryption private key", () => {
        it("only when the creator requests it")
        it("only when the process ID exists")
        it("only when the process is not canceled")
        it("only after endTime")
        it("only if the key matches the public key registered")
        it("should retrieve the submited private key")
    })

})
