const assert = require("assert")
const { getWeb3, increaseTimestamp, deployVotingProcess } = require("../lib/util")

const web3 = getWeb3()

let accounts
let instance

let entityAddress, validatorAddress, randomAddress1, randomAddress2

const processMetadataHash = "ipfs://ipfs/1234"
const voteEncryptionPrivateKey = "0x1234"

describe('VotingProcess', function () {

    beforeEach(async () => {
        accounts = await web3.eth.getAccounts()

        deployAddress = accounts[0]
        entityAddress = accounts[1]
        validatorAddress = accounts[2]
        randomAddress1 = accounts[3]
        randomAddress2 = accounts[4]

        genesis = "0x1234567890123456789012345678901234567890123123123"
        chainId = 0

        instance = await deployVotingProcess(deployAddress)
    })


    it("should deploy the contract", async () => {
        const localInstance = await deployVotingProcess(deployAddress)

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
        const processId1Expected = await instance.methods.getProcessId(entityAddress, 0).call()
        const processId1Actual = await instance.methods.getNextProcessId(entityAddress).call()

        assert.equal(processId1Expected, processId1Actual)

        await instance.methods.create(
            processMetadataHash,
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

            await instance.methods.create(

                processMetadataHash,
            )
                .send({
                    from: entityAddress,
                    nonce: await web3.eth.getTransactionCount(entityAddress)
                })

            let processIdExpected = await instance.methods.getProcessId(entityAddress, 1).call()
            let processIdActual = await instance.methods.getNextProcessId(entityAddress).call()
            assert.equal(processIdExpected, processIdActual)

            await instance.methods.create(

                processMetadataHash,
            )
                .send({
                    from: randomAddress1,
                    nonce: await web3.eth.getTransactionCount(randomAddress1)
                })

            processIdExpected = await instance.methods.getProcessId(randomAddress1, 1).call()
            processIdActual = await instance.methods.getNextProcessId(randomAddress1).call()
            assert.equal(processIdExpected, processIdActual)

            await instance.methods.create(

                processMetadataHash,
            )
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

            let result = await instance.methods.create(
                processMetadataHash,
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
       
        it("should increase the processCount of the entity on success", async () => {
            const prev = Number(await instance.methods.entityProcessCount(entityAddress).call())
            assert.equal(prev, 0)

            

            await instance.methods.create(
                processMetadataHash,
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

            try {
                await instance.methods.create(
                    "",
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
           
            const processMetadataHash = "ipfs://ipfs/some-hash-here"
            const voteEncryptionPublicKey = "TESTING-ENCRYPTION_KEY"

            let blockNumber = await web3.eth.getBlockNumber()
            let startTime = (await web3.eth.getBlock(blockNumber)).timestamp + 100
            let endTime = startTime + 100

            await instance.methods.create(
              
                processMetadataHash,
               
            ).send({
                from: entityAddress,
                nonce: await web3.eth.getTransactionCount(entityAddress)
            })

            const count = Number(await instance.methods.entityProcessCount(entityAddress).call())
            const processId = await instance.methods.getProcessId(entityAddress, count - 1).call()

            const processData = await instance.methods.get(processId).call()

           
            assert.equal(processData.entityAddress, entityAddress)
            assert.equal(processData.processMetadataHash, processMetadataHash)
            assert.equal(processData.canceled, false, "The process should not start as canceled")

            const privateKey = await instance.methods.getPrivateKey(processId).call()
            assert.equal(privateKey, "")
        })
    })
    
        describe("should cancel the process", () => {
            it("only when the entityAddress requests it", async () => {
              
                const processId1 = await instance.methods.getProcessId(entityAddress, 0).call()
    
                // Create
                const result1 = await instance.methods.create(
                  
                    processMetadataHash,
                  
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
    
                
                assert.equal(processData1.entityAddress, entityAddress)
                assert.equal(processData1.processMetadataHash, processMetadataHash)
                assert.equal(processData1.canceled, true, "The process should now be canceled")
    
                // CREATE AGAIN
    
                const processId2 = await instance.methods.getProcessId(entityAddress, 1).call()
    
                // Create
                const result3 = await instance.methods.create(                
                    processMetadataHash,
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
                 
                assert.equal(processData2.entityAddress, entityAddress)
                assert.equal(processData2.processMetadataHash, processMetadataHash)
                assert.equal(processData2.canceled, false, "The process should remain active")
    
            })
            it("only if is not yet canceled", async () => {
              
                const processId1 = await instance.methods.getProcessId(entityAddress, 0).call()
    
                // Create
                const result1 = await instance.methods.create(
                    processMetadataHash,                  
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
    
              
                assert.equal(processData1.entityAddress, entityAddress)
                assert.equal(processData1.processMetadataHash, processMetadataHash)
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
    
                assert.equal(processData2.entityAddress, entityAddress)
                assert.equal(processData2.processMetadataHash, processMetadataHash)
                assert.equal(processData2.canceled, true, "The process should now be canceled")   
            })
    
            it("should emit an event", async () => {
                const processId1 = await instance.methods.getProcessId(entityAddress, 0).call()
    
                // Create
                const result1 = await instance.methods.create(
                    processMetadataHash,
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

        describe("should register a validator", () => {
    
            const validatorPublicKey = "0x1234"
    
            it("only when the contract owner requests it", async () => {
    
                // Register a validator
                const result2 = await instance.methods.addValidator(
                    validatorPublicKey,
                ).send({
                    from: deployAddress,
                    nonce: await web3.eth.getTransactionCount(entityAddress)
                })
    
                assert.ok(result2.transactionHash)
    
                // Get validator list
                const result3 = await instance.methods.getValidators().call()
                assert.equal(result3.length, 1)
    
                // Attempt to add a validator by someone else
                try {
                    await instance.methods.addValidator(
                        validatorPublicKey,
                    ).send({
                        from: randomAddress1, // <<--
                        nonce: await web3.eth.getTransactionCount(randomAddress1)
                    })
    
                    assert.fail("The transaction should have thrown an error but didn't")
                }
                catch (err) {
                    assert(err.message.match(/revert/), "The transaction threw an unexpected error:\n" + err.message)
                }
    
                // Get validator list
                const result4 = await instance.methods.getValidators().call()
                assert.equal(result4.length, 1)
    
            })
           
            it("should fail if NOT owner adds Validator", async () => {
                
                const processId = await instance.methods.getProcessId(entityAddress, 0).call()
    
                // Create
                const result1 = await instance.methods.create(
                    processMetadataHash,
                ).send({
                    from: entityAddress,
                    nonce: await web3.eth.getTransactionCount(entityAddress)
                })
    
                assert.ok(result1.transactionHash)
    
                // Register a validator
                const result2 = await instance.methods.addValidator(
                    validatorPublicKey,
                ).send({
                    from: entityAddress,
                    nonce: await web3.eth.getTransactionCount(entityAddress)
                })
    
                assert.ok(result2.transactionHash)
    
                // Get validator list
                const result3 = await instance.methods.getValidators().call()
                assert.equal(result3.length, 1)
    
                // Attempt to add a validator by someone else
                try {
                    await instance.methods.addValidator(
                        validatorPublicKey,
                    ).send({
                        from: entityAddress,
                        nonce: await web3.eth.getTransactionCount(entityAddress)
                    })
    
                    assert.fail("The transaction should have thrown an error but didn't")
                }
                catch (err) {
                    assert(err.message.match(/revert/), "The transaction threw an unexpected error:\n" + err.message)
                }
    
                // Get validator list
                const result4 = await instance.methods.getValidators().call()
                assert.equal(result4.length, 1)
    
            })
            it("should add the validator address to the validator list", async () => {

                const processId = await instance.methods.getProcessId(entityAddress, 0).call()
    
                // Create
                const result1 = await instance.methods.create(
                    processMetadataHash,
                ).send({
                    from: entityAddress,
                    nonce: await web3.eth.getTransactionCount(entityAddress)
                })
    
                assert.ok(result1.transactionHash)
    
                // Register validator 1
                const result2 = await instance.methods.addValidator(
                    validatorPublicKey,
                ).send({
                    from: entityAddress,
                    nonce: await web3.eth.getTransactionCount(entityAddress)
                })
    
                assert.ok(result2.transactionHash)
    
                // Get validator list
                const result3 = await instance.methods.getValidators().call()
                assert.equal(result3.length, 1)
                assert.deepEqual(result3, [validatorAddress])
    
                // Adding validator #2
                const result4 = await instance.methods.addValidator(
                    validatorPublicKey,
                ).send({
                    from: entityAddress,
                    nonce: await web3.eth.getTransactionCount(entityAddress)
                })
    
                assert.ok(result4.transactionHash)
    
                // Get validator list
                const result5 = await instance.methods.getValidators().call()
                assert.equal(result5.length, 2)
    
            })
            
            it("should emit an event", async () => {
                const processId = await instance.methods.getProcessId(entityAddress, 0).call()
    
                // Create
                const result1 = await instance.methods.create(
                    processMetadataHash,
                ).send({
                    from: entityAddress,
                    nonce: await web3.eth.getTransactionCount(entityAddress)
                })
    
                assert.ok(result1.transactionHash)
    
                // Register validator
                const result2 = await instance.methods.addValidator(
                    validatorPublicKey,
                ).send({
                    from: entityAddress,
                    nonce: await web3.eth.getTransactionCount(entityAddress)
                })
    
                assert.ok(result2)
                assert.ok(result2.events)
                assert.ok(result2.events.ValidatorAdded)
                assert.ok(result2.events.ValidatorAdded.returnValues)
                assert.equal(result2.events.ValidatorAdded.event, "ValidatorAdded")
                assert.equal(result2.events.ValidatorAdded.returnValues.processId, processId)
    
            })
        })
    
        describe("should remove a validator", () => {
    
            const validatorPublicKey = "0x1234"
    
            it("only when the creator requests it", async () => {
                const processId = await instance.methods.getProcessId(entityAddress, 0).call()
    
                // Create
                const result1 = await instance.methods.create(
                    processMetadataHash,
                ).send({
                    from: entityAddress,
                    nonce: await web3.eth.getTransactionCount(entityAddress)
                })
    
                assert.ok(result1.transactionHash)
    
                // Register validator
                await instance.methods.addValidator(
                    validatorPublicKey,
                ).send({
                    from: entityAddress,
                    nonce: await web3.eth.getTransactionCount(entityAddress)
                })
    
                // Attempt to disable the validator from someone else
                try {
                    await instance.methods.removeValidator(
                        idx,
                        validatorPublicKey
                    ).send({
                        from: randomAddress1,   // <<--
                        nonce: await web3.eth.getTransactionCount(randomAddress1)
                    })
                    assert.fail("The transaction should have thrown an error but didn't")
                }
                catch (err) {
                    assert(err.message.match(/revert/), "The transaction threw an unexpected error:\n" + err.message)
                }
    
                // Get validator list
                const result2 = await instance.methods.getValidators().call()
                assert.equal(result2.length, 1)
    
                // Disable validator from the creator
                const result3 = await instance.methods.removeValidator(
                    idx,
                    validatorPublicKey
                ).send({
                    from: entityAddress,
                    nonce: await web3.eth.getTransactionCount(entityAddress)
                })
    
                // Get validator list
                const result4 = await instance.methods.getValidators().call()
                assert.equal(result4.length, 0)
                assert.deepEqual(result4, [])
    
            })
            
            it("should fail if the idx does not match validatorPublicKey", async () => {

                const processId = await instance.methods.getProcessId(entityAddress, 0).call()
                const nonExistingValidatorPublicKey = "0x123123"
                // Create
                const result1 = await instance.methods.create(
                    processMetadataHash,
                ).send({
                    from: entityAddress,
                    nonce: await web3.eth.getTransactionCount(entityAddress)
                })
    
                assert.equal(result1.events.ProcessCreated.returnValues.processId, processId)
    
                // Register a validator
                const result2 = await instance.methods.addValidator(
                    validatorPublicKey,
                ).send({
                    from: entityAddress,
                    nonce: await web3.eth.getTransactionCount(entityAddress)
                })
    
                assert.ok(result2.transactionHash)
    
                // Attempt to disable non-existing validator
                try {
                    await instance.methods.removeValidator(
                        idx,
                        nonExistingValidatorPublicKey   // <<--
                    ).send({
                        from: entityAddress,
                        nonce: await web3.eth.getTransactionCount(entityAddress)
                    })
    
                    assert.fail("The transaction should have thrown an error but didn't")
                }
                catch (err) {
                    assert(err.message.match(/revert/), "The transaction threw an unexpected error:\n" + err.message)
                }
    
                // Get validator list
                const result4 = await instance.methods.getValidators().call()
                assert.equal(result4.length, 1)
                assert.deepEqual(result4, [validatorAddress])
    
            })
            
            it("should emit an event", async () => {

                const processId = await instance.methods.getProcessId(entityAddress, 0).call()
    
                // Create
                const result1 = await instance.methods.create(
                    processMetadataHash,
                ).send({
                    from: entityAddress,
                    nonce: await web3.eth.getTransactionCount(entityAddress)
                })
    
                assert.ok(result1.transactionHash)
    
                // Register validator
                await instance.methods.addValidator(
                    validatorPublicKey,
                ).send({
                    from: entityAddress,
                    nonce: await web3.eth.getTransactionCount(entityAddress)
                })
    
                // Disable validator
                const result3 = await instance.methods.removeValidator(
                    idx,
                    validatorPublicKey
                ).send({
                    from: entityAddress,
                    nonce: await web3.eth.getTransactionCount(entityAddress)
                })
    
                assert.ok(result3)
                assert.ok(result3.events)
                assert.ok(result3.events.ValidatorRemoved)
                assert.ok(result3.events.ValidatorRemoved.returnValues)
                assert.equal(result3.events.ValidatorRemoved.event, "ValidatorRemoved")
                assert.equal(result3.events.ValidatorRemoved.returnValues.processId, processId)
    
            })
        })

        describe("should register an oracle", () => {
    
            const oraclePublicKey = "0x1234"
    
            it("only when the creator requests it", async () => {
             
                const processId = await instance.methods.getProcessId(entityAddress, 0).call()
    
                // Create
                const result1 = await instance.methods.create(
                    processMetadataHash,
                ).send({
                    from: entityAddress,
                    nonce: await web3.eth.getTransactionCount(entityAddress)
                })
    
                assert.ok(result1.transactionHash)
    
                // Register a validator
                const result2 = await instance.methods.pushOracle(
                    oraclePublicKey,
                ).send({
                    from: entityAddress,
                    nonce: await web3.eth.getTransactionCount(entityAddress)
                })
    
                assert.ok(result2.transactionHash)
    
                // Get validator list
                const result3 = await instance.methods.getOracles().call()
                assert.equal(result3.length, 1)
    
                // Attempt to add a validator by someone else
                try {
                    await instance.methods.pushOracle(
                        oraclePublicKey,
                    ).send({
                        from: randomAddress1, // <<--
                        nonce: await web3.eth.getTransactionCount(randomAddress1)
                    })
    
                    assert.fail("The transaction should have thrown an error but didn't")
                }
                catch (err) {
                    assert(err.message.match(/revert/), "The transaction threw an unexpected error:\n" + err.message)
                }
    
                // Get validator list
                const result4 = await instance.methods.getOracles().call()
                assert.equal(result4.length, 1)
    
            })
           
            it("should fail if it already NOT owner adds Oracle", async () => {
                
                const processId = await instance.methods.getProcessId(entityAddress, 0).call()
    
                // Create
                const result1 = await instance.methods.create(
                    processMetadataHash,
                ).send({
                    from: entityAddress,
                    nonce: await web3.eth.getTransactionCount(entityAddress)
                })
    
                assert.ok(result1.transactionHash)
    
                // Register a validator
                const result2 = await instance.methods.pushOracle(
                    oraclePublicKey,
                ).send({
                    from: entityAddress,
                    nonce: await web3.eth.getTransactionCount(entityAddress)
                })
    
                assert.ok(result2.transactionHash)
    
                // Get validator list
                const result3 = await instance.methods.getOracles().call()
                assert.equal(result3.length, 1)
    
                // Attempt to add a validator by someone else
                try {
                    await instance.methods.pushOracle(
                        oraclePublicKey,
                    ).send({
                        from: entityAddress,
                        nonce: await web3.eth.getTransactionCount(entityAddress)
                    })
    
                    assert.fail("The transaction should have thrown an error but didn't")
                }
                catch (err) {
                    assert(err.message.match(/revert/), "The transaction threw an unexpected error:\n" + err.message)
                }
    
                // Get validator list
                const result4 = await instance.methods.getOracles().call()
                assert.equal(result4.length, 1)
    
            })
            it("should add the oracle publicKey to the oracles list", async () => {

                const processId = await instance.methods.getProcessId(entityAddress, 0).call()
    
                // Create
                const result1 = await instance.methods.create(
                    processMetadataHash,
                ).send({
                    from: entityAddress,
                    nonce: await web3.eth.getTransactionCount(entityAddress)
                })
    
                assert.ok(result1.transactionHash)
    
                // Register validator 1
                const result2 = await instance.methods.pushOracle(
                    oraclePublicKey,
                ).send({
                    from: entityAddress,
                    nonce: await web3.eth.getTransactionCount(entityAddress)
                })
    
                assert.ok(result2.transactionHash)
    
                // Get validator list
                const result3 = await instance.methods.getOracles().call()
                assert.equal(result3.length, 1)
                assert.deepEqual(result3, [validatorAddress])
    
                // Adding validator #2
                const result4 = await instance.methods.pushOracle(
                    oraclePublicKey,
                ).send({
                    from: entityAddress,
                    nonce: await web3.eth.getTransactionCount(entityAddress)
                })
    
                assert.ok(result4.transactionHash)
    
                // Get validator list
                const result5 = await instance.methods.getOracles().call()
                assert.equal(result5.length, 2)
    
            })
            
            it("should emit an event", async () => {
                const processId = await instance.methods.getProcessId(entityAddress, 0).call()
    
                // Create
                const result1 = await instance.methods.create(
                    processMetadataHash,
                ).send({
                    from: entityAddress,
                    nonce: await web3.eth.getTransactionCount(entityAddress)
                })
    
                assert.ok(result1.transactionHash)
    
                // Register validator
                const result2 = await instance.methods.pushOracle(
                    oraclePublicKey,
                ).send({
                    from: entityAddress,
                    nonce: await web3.eth.getTransactionCount(entityAddress)
                })
    
                assert.ok(result2)
                assert.ok(result2.events)
                assert.ok(result2.events.OracleAdded)
                assert.ok(result2.events.OracleAdded.returnValues)
                assert.equal(result2.events.OracleAdded.event, "OracleAdded")
                assert.equal(result2.events.OracleAdded.returnValues.processId, processId)
    
            })
        })
    
        describe("should remove an oracle", () => {
    
            const oraclePublicKey = "0x1234"
    
            it("only when the creator requests it", async () => {
                const processId = await instance.methods.getProcessId(entityAddress, 0).call()
    
                // Create
                const result1 = await instance.methods.create(
                    processMetadataHash,
                ).send({
                    from: entityAddress,
                    nonce: await web3.eth.getTransactionCount(entityAddress)
                })
    
                assert.ok(result1.transactionHash)
    
                // Register validator
                await instance.methods.pushOracle(
                    oraclePublicKey,
                ).send({
                    from: entityAddress,
                    nonce: await web3.eth.getTransactionCount(entityAddress)
                })
    
                // Attempt to disable the validator from someone else
                try {
                    await instance.methods.removeOracle(
                        idx,
                        oraclePublicKey
                    ).send({
                        from: randomAddress1,   // <<--
                        nonce: await web3.eth.getTransactionCount(randomAddress1)
                    })
                    assert.fail("The transaction should have thrown an error but didn't")
                }
                catch (err) {
                    assert(err.message.match(/revert/), "The transaction threw an unexpected error:\n" + err.message)
                }
    
                // Get validator list
                const result2 = await instance.methods.getOracles().call()
                assert.equal(result2.length, 1)
    
                // Disable validator from the creator
                const result3 = await instance.methods.removeOracle(
                    idx,
                    oraclePublicKey
                ).send({
                    from: entityAddress,
                    nonce: await web3.eth.getTransactionCount(entityAddress)
                })
    
                // Get validator list
                const result4 = await instance.methods.getOracles().call()
                assert.equal(result4.length, 0)
                assert.deepEqual(result4, [])
    
            })
            
            it("should fail if the idx does not match oraclePublicKey", async () => {

                const processId = await instance.methods.getProcessId(entityAddress, 0).call()
                const nonExistingoraclePublicKey = "0x123123"
                // Create
                const result1 = await instance.methods.create(
                    processMetadataHash,
                ).send({
                    from: entityAddress,
                    nonce: await web3.eth.getTransactionCount(entityAddress)
                })
    
                assert.equal(result1.events.ProcessCreated.returnValues.processId, processId)
    
                // Register a validator
                const result2 = await instance.methods.pushOracle(
                    oraclePublicKey,
                ).send({
                    from: entityAddress,
                    nonce: await web3.eth.getTransactionCount(entityAddress)
                })
    
                assert.ok(result2.transactionHash)
    
                // Attempt to disable non-existing validator
                try {
                    await instance.methods.removeOracle(
                        idx,
                        nonExistingoraclePublicKey   // <<--
                    ).send({
                        from: entityAddress,
                        nonce: await web3.eth.getTransactionCount(entityAddress)
                    })
    
                    assert.fail("The transaction should have thrown an error but didn't")
                }
                catch (err) {
                    assert(err.message.match(/revert/), "The transaction threw an unexpected error:\n" + err.message)
                }
    
                // Get validator list
                const result4 = await instance.methods.getOracles().call()
                assert.equal(result4.length, 1)
                assert.deepEqual(result4, [validatorAddress])
    
            })
            
            it("should emit an event", async () => {

                const processId = await instance.methods.getProcessId(entityAddress, 0).call()
    
                // Create
                const result1 = await instance.methods.create(
                    processMetadataHash,
                ).send({
                    from: entityAddress,
                    nonce: await web3.eth.getTransactionCount(entityAddress)
                })
    
                assert.ok(result1.transactionHash)
    
                // Register validator
                await instance.methods.pushOracle(
                    oraclePublicKey,
                ).send({
                    from: entityAddress,
                    nonce: await web3.eth.getTransactionCount(entityAddress)
                })
    
                // Disable validator
                const result3 = await instance.methods.removeOracle(
                    idx,
                    oraclePublicKey
                ).send({
                    from: entityAddress,
                    nonce: await web3.eth.getTransactionCount(entityAddress)
                })
    
                assert.ok(result3)
                assert.ok(result3.events)
                assert.ok(result3.events.OracleRemoved)
                assert.ok(result3.events.OracleRemoved.returnValues)
                assert.equal(result3.events.OracleRemoved.event, "OracleRemoved")
                assert.equal(result3.events.OracleRemoved.returnValues.processId, processId)
    
            })
        })
    
        describe("should accept the encryption private key", () => {
    
            const validatorPublicKey = "0x1234"
            const privateKey = "0x01234567890"
    
            it("only when the creator requests it", async () => {
                const processId = await instance.methods.getProcessId(entityAddress, 0).call()
    
                // Create
                const result1 = await instance.methods.create(
                    processMetadataHash,
                ).send({
                    from: entityAddress,
                    nonce: await web3.eth.getTransactionCount(entityAddress)
                })
    
                assert.ok(result1.transactionHash)
    
                // Register validator
                await instance.methods.addValidator(
                    validatorPublicKey,
                ).send({
                    from: entityAddress,
                    nonce: await web3.eth.getTransactionCount(entityAddress)
                })
    
               
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
                const processId = await instance.methods.getProcessId(entityAddress, 0).call()
    
                // Create
                const result1 = await instance.methods.create(
                    processMetadataHash,
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
            
            it("should retrieve the submited private key", async () => {

                const processId = await instance.methods.getProcessId(entityAddress, 0).call()
    
                // Create
                const result1 = await instance.methods.create(
                    processMetadataHash,
                ).send({
                    from: entityAddress,
                    nonce: await web3.eth.getTransactionCount(entityAddress)
                })
                assert.ok(result1.transactionHash)
    
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
 // NOW + 3
    
                const processId = await instance.methods.getProcessId(entityAddress, 0).call()
    
                // Create
                const result1 = await instance.methods.create(
                    processMetadataHash,
                ).send({
                    from: entityAddress,
                    nonce: await web3.eth.getTransactionCount(entityAddress)
                })
                assert.ok(result1.transactionHash)
    
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
            it("should emit an event", async () => {  // NOW + 3
    
                const processId = await instance.methods.getProcessId(entityAddress, 0).call()
    
                // Create
                const result1 = await instance.methods.create(
                    processMetadataHash,
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
    
})
