
import "mocha" // using @types/mocha
import { expect } from "chai"
import { Contract, Wallet, ContractFactory, ContractTransaction } from "ethers"
import { addCompletionHooks } from "../utils/mocha-hooks"
import { getAccounts, incrementTimestamp, TestAccount } from "../utils"
import { VotingProcessContractMethods, ProcessStatus, ProcessEnvelopeType, ProcessMode } from "../../lib"

import ProcessBuilder, { DEFAULT_METADATA_CONTENT_HASHED_URI, DEFAULT_MERKLE_ROOT, DEFAULT_MERKLE_TREE_CONTENT_HASHED_URI, DEFAULT_START_BLOCK, DEFAULT_NUMBER_OF_BLOCKS, DEFAULT_QUESTION_COUNT, DEFAULT_CHAIN_ID } from "../builders/process"
import { BigNumber } from "ethers/utils"

const { abi: votingProcessAbi, bytecode: votingProcessByteCode } = require("../../build/voting-process.json")

let accounts: TestAccount[]
let deployAccount: TestAccount
let entityAccount: TestAccount
let randomAccount1: TestAccount
let randomAccount2: TestAccount
let authorizedOracleAccount1: TestAccount
let authorizedOracleAccount2: TestAccount
let processId: string
let contractInstance: VotingProcessContractMethods & Contract
let chainId: number
let questionCount: number
let tx: ContractTransaction

addCompletionHooks()

describe("Voting Process", () => {
    beforeEach(async () => {
        accounts = getAccounts()
        deployAccount = accounts[0]
        entityAccount = accounts[1]
        randomAccount1 = accounts[2]
        randomAccount2 = accounts[3]
        authorizedOracleAccount1 = accounts[4]
        authorizedOracleAccount2 = accounts[5]

        chainId = DEFAULT_CHAIN_ID
        questionCount = 2
        tx = null

        contractInstance = await new ProcessBuilder().build()
        processId = await contractInstance.getProcessId(entityAccount.address, 0)
    })

    it("should deploy the contract", async () => {
        let validModes = [0, 1, 3]
        let validEnvelopeTypes = [0, 1, 4, 6, 8, 10, 12, 14]

        const contractFactory = new ContractFactory(votingProcessAbi, votingProcessByteCode, entityAccount.wallet)
        const localInstance = await contractFactory.deploy(chainId, validModes, validEnvelopeTypes)

        expect(localInstance).to.be.ok
        expect(localInstance.address).to.match(/^0x[0-9a-fA-F]{40}$/)
    })

    it("should compute a processId based on the entity address and the process index", async () => {
        expect(contractInstance.getProcessId).to.be.ok
        expect(contractInstance.getProcessId.call).to.be.ok

        const proc1 = await contractInstance.getProcessId(accounts[0].address, 0)
        const proc2 = await contractInstance.getProcessId(accounts[0].address, 0)

        const proc3 = await contractInstance.getProcessId(accounts[0].address, 1)
        const proc4 = await contractInstance.getProcessId(accounts[0].address, 1)

        const proc5 = await contractInstance.getProcessId(accounts[0].address, 2)
        const proc6 = await contractInstance.getProcessId(accounts[0].address, 3)

        const proc7 = await contractInstance.getProcessId(accounts[1].address, 0)
        const proc8 = await contractInstance.getProcessId(accounts[1].address, 1)

        expect(proc1).to.eq(proc2)
        expect(proc3).to.eq(proc4)

        expect(proc1).to.not.eq(proc3)
        expect(proc1).to.not.eq(proc5)
        expect(proc1).to.not.eq(proc6)

        expect(proc3).to.not.eq(proc5)
        expect(proc3).to.not.eq(proc6)

        expect(proc5).to.not.eq(proc6)

        expect(proc7).to.not.eq(proc1)
        expect(proc8).to.not.eq(proc3)
    })

    it("should compute the next processId", async () => {
        // The entity already has 1 process at the moment
        const count1 = await contractInstance.getEntityProcessCount(entityAccount.address)
        expect(count1.toNumber()).to.eq(1)
        const processId1Expected = await contractInstance.getProcessId(entityAccount.address, count1.toNumber())
        const processId1Actual = await contractInstance.getNextProcessId(entityAccount.address)

        expect(processId1Actual).to.eq(processId1Expected)

        tx = await contractInstance.create(
            ProcessMode.make({ scheduled: true }),
            ProcessEnvelopeType.make({}),
            DEFAULT_METADATA_CONTENT_HASHED_URI,
            DEFAULT_MERKLE_ROOT,
            DEFAULT_MERKLE_TREE_CONTENT_HASHED_URI,
            DEFAULT_START_BLOCK,
            DEFAULT_NUMBER_OF_BLOCKS,
            DEFAULT_QUESTION_COUNT
        )
        await tx.wait()

        // The entity has 2 processes now
        // So the next process index is 2
        const processId2Expected = await contractInstance.getProcessId(entityAccount.address, 2)
        const processId2Actual = await contractInstance.getNextProcessId(entityAccount.address)

        expect(processId1Actual).to.not.eq(processId2Actual)
        expect(processId2Actual).to.eq(processId2Expected)
    })

    describe("should set genesis", () => {
        let genesis
        beforeEach(() => {
            genesis = "0x1234567890123456789012345678901234567890123123123"
        })

        it("only contract creator", async () => {
            try {
                contractInstance = contractInstance.connect(randomAccount1.wallet) as any
                tx = await contractInstance.setGenesis(genesis)
                await tx.wait()
                throw new Error("The transaction should have thrown an error but didn't")
            }
            catch (err) {
                expect(err.message).to.match(/revert/, "The transaction threw an unexpected error:\n" + err.message)
            }
        })

        it("should persist", async () => {
            contractInstance = contractInstance.connect(deployAccount.wallet) as any
            tx = await contractInstance.setGenesis(genesis)
            await tx.wait()

            let currentGenesis = await contractInstance.getGenesis()
            expect(currentGenesis).to.eq(genesis, "Gensis should match")

            // Another genesis value
            tx = await contractInstance.setGenesis("1234")
            await tx.wait()

            currentGenesis = await contractInstance.getGenesis()
            expect(currentGenesis).to.eq("1234", "Gensis should match")
        })

        it("should emit an event", async () => {
            contractInstance = contractInstance.connect(deployAccount.wallet) as any

            const result: { genesis: string } = await new Promise((resolve, reject) => {
                contractInstance.on("GenesisChanged", (genesis: string) => {
                    resolve({ genesis })
                })
                contractInstance.setGenesis(genesis).then(tx => tx.wait()).catch(reject)
            })

            expect(result).to.be.ok
            expect(result.genesis).to.equal(genesis)
        }).timeout(7000)
    })

    describe("should set chainId", () => {

        it("only contract creator", async () => {
            try {
                contractInstance = contractInstance.connect(randomAccount1.wallet) as any
                tx = await contractInstance.setChainId(chainId)
                await tx.wait()
                throw new Error("The transaction should have thrown an error but didn't")
            }
            catch (err) {
                expect(err.message).to.match(/revert/, "The transaction threw an unexpected error:\n" + err.message)
            }
        })

        it("should persist", async () => {
            const chainValue = 200
            contractInstance = contractInstance.connect(deployAccount.wallet) as any

            tx = await contractInstance.setChainId(chainValue)
            await tx.wait()

            await new Promise(resolve => setTimeout(resolve, 1500))

            let currentChainId = await contractInstance.getChainId()
            expect(currentChainId.toNumber()).to.eq(chainValue, "ChainId should match")
        })

        it("should fail if duplicated", async () => {
            contractInstance = contractInstance.connect(deployAccount.wallet) as any

            try {
                // same that it already is
                tx = await contractInstance.setChainId(chainId)
                await tx.wait()

                throw new Error("The transaction should have thrown an error but didn't")
            }
            catch (err) {
                expect(err.message).to.match(/revert/, "The transaction threw an unexpected error:\n" + err.message)
            }
        })

        it("should emit an event", async () => {
            const newChainId = 200
            contractInstance = contractInstance.connect(deployAccount.wallet) as any

            const result: { chainId: BigNumber } = await new Promise((resolve, reject) => {
                contractInstance.on("ChainIdChanged", (chainId: BigNumber) => {
                    resolve({ chainId })
                })
                contractInstance.setChainId(newChainId).then(tx => tx.wait()).catch(reject)
            })

            expect(result).to.be.ok
            expect(result.chainId.toNumber()).to.equal(newChainId)
        }).timeout(7000)
    })

    describe("supported process modes", () => {
        it("should add and remove modes", async () => {
            contractInstance = contractInstance.connect(deployAccount.wallet) as any

            for (let i = 32; i < 40; i++) {
                // add envelope type
                tx = await contractInstance.enableMode(i)
                await tx.wait()

                expect(await contractInstance.isModeEnabled(i)).to.be.true

                // cannot add twice
                try {
                    tx = await contractInstance.enableMode(i)
                    throw new Error("The transaction should have thrown an error but didn't")
                }
                catch (err) {
                    expect(err.message).to.match(/revert/, "The transaction threw an unexpected error:\n" + err.message)
                }

                // check still added
                expect(await contractInstance.isModeEnabled(i)).to.be.true

                // now disable
                tx = await contractInstance.disableMode(i)
                await tx.wait()

                expect(await contractInstance.isModeEnabled(i)).to.be.false
            }
        }).timeout(4000)

        it("should only be modified by contract owner", async () => {
            for (let i = 32; i < 48; i++) {
                // account 2
                contractInstance = contractInstance.connect(randomAccount1.wallet) as any
                expect(await contractInstance.isModeEnabled(i)).to.be.false

                // cannot add
                try {
                    tx = await contractInstance.enableMode(i)
                    throw new Error("The transaction should have thrown an error but didn't")
                }
                catch (err) {
                    expect(err.message).to.match(/revert/, "The transaction threw an unexpected error:\n" + err.message)
                }
                // account 2
                contractInstance = contractInstance.connect(randomAccount2.wallet) as any
                expect(await contractInstance.isModeEnabled(i)).to.be.false

                // cannot add
                try {
                    tx = await contractInstance.enableMode(i)
                    throw new Error("The transaction should have thrown an error but didn't")
                }
                catch (err) {
                    expect(err.message).to.match(/revert/, "The transaction threw an unexpected error:\n" + err.message)
                }
                expect(await contractInstance.isModeEnabled(i)).to.be.false
            }
        })

        it("should emit an event when added", async () => {
            contractInstance = contractInstance.connect(deployAccount.wallet) as any

            const result: { type: string } = await new Promise((resolve, reject) => {
                contractInstance.on("ModeEnabled", (type: string) => {
                    resolve({ type })
                })
                contractInstance.enableMode(64).then(tx => tx.wait()).catch(reject)
            })

            expect(result).to.be.ok
            expect(result.type).to.equal(64)
        }).timeout(7000)

        it("should emit an event when removed", async () => {
            contractInstance = contractInstance.connect(deployAccount.wallet) as any

            tx = await contractInstance.enableMode(64)
            await tx.wait()

            const result: { type: string } = await new Promise((resolve, reject) => {
                contractInstance.on("ModeDisabled", (type: string) => {
                    resolve({ type })
                })
                contractInstance.disableMode(64).then(tx => tx.wait()).catch(reject)
            })

            expect(result).to.be.ok
            expect(result.type).to.equal(64)
        }).timeout(7000)
    })

    describe("supported envelope types", () => {
        it("should add and remove envelope types", async () => {
            contractInstance = contractInstance.connect(deployAccount.wallet) as any

            for (let i = 32; i < 40; i++) {
                // add envelope type
                tx = await contractInstance.enableEnvelopeType(i)
                await tx.wait()

                expect(await contractInstance.isEnvelopeTypeEnabled(i)).to.be.true

                // cannot add twice
                try {
                    tx = await contractInstance.enableEnvelopeType(i)
                    throw new Error("The transaction should have thrown an error but didn't")
                }
                catch (err) {
                    expect(err.message).to.match(/revert/, "The transaction threw an unexpected error:\n" + err.message)
                }

                // check still added
                expect(await contractInstance.isEnvelopeTypeEnabled(i)).to.be.true

                // now disable
                tx = await contractInstance.disableEnvelopeType(i)
                await tx.wait()

                expect(await contractInstance.isEnvelopeTypeEnabled(i)).to.be.false
            }
        }).timeout(4000)

        it("should only be modified by contract owner", async () => {
            for (let i = 32; i < 48; i++) {
                // account 2
                contractInstance = contractInstance.connect(randomAccount1.wallet) as any
                expect(await contractInstance.isEnvelopeTypeEnabled(i)).to.be.false

                // cannot add
                try {
                    tx = await contractInstance.enableEnvelopeType(i)
                    throw new Error("The transaction should have thrown an error but didn't")
                }
                catch (err) {
                    expect(err.message).to.match(/revert/, "The transaction threw an unexpected error:\n" + err.message)
                }
                // account 2
                contractInstance = contractInstance.connect(randomAccount2.wallet) as any
                expect(await contractInstance.isEnvelopeTypeEnabled(i)).to.be.false

                // cannot add
                try {
                    tx = await contractInstance.enableEnvelopeType(i)
                    throw new Error("The transaction should have thrown an error but didn't")
                }
                catch (err) {
                    expect(err.message).to.match(/revert/, "The transaction threw an unexpected error:\n" + err.message)
                }
                expect(await contractInstance.isEnvelopeTypeEnabled(i)).to.be.false
            }
        })

        it("should emit an event when added", async () => {
            contractInstance = contractInstance.connect(deployAccount.wallet) as any

            const result: { type: string } = await new Promise((resolve, reject) => {
                contractInstance.on("EnvelopeTypeEnabled", (type: string) => {
                    resolve({ type })
                })
                contractInstance.enableEnvelopeType(64).then(tx => tx.wait()).catch(reject)
            })

            expect(result).to.be.ok
            expect(result.type).to.equal(64)
        }).timeout(7000)

        it("should emit an event when removed", async () => {
            contractInstance = contractInstance.connect(deployAccount.wallet) as any

            tx = await contractInstance.enableEnvelopeType(64)
            await tx.wait()

            const result: { type: string } = await new Promise((resolve, reject) => {
                contractInstance.on("EnvelopeTypeDisabled", (type: string) => {
                    resolve({ type })
                })
                contractInstance.disableEnvelopeType(64).then(tx => tx.wait()).catch(reject)
            })

            expect(result).to.be.ok
            expect(result.type).to.equal(64)
        }).timeout(7000)
    })

    describe("should create processes", () => {
        it("should allow anyone to create a process", async () => {
            expect(contractInstance.create).to.be.ok

            // one is already created by the builder

            let processIdExpected = await contractInstance.getProcessId(entityAccount.address, 1)
            let processIdActual = await contractInstance.getNextProcessId(entityAccount.address)
            expect(processIdExpected).to.eq(processIdActual)

            // 2
            contractInstance = contractInstance.connect(randomAccount1.wallet) as any
            tx = await contractInstance.create(ProcessMode.make({ scheduled: true }), ProcessEnvelopeType.make({}), DEFAULT_METADATA_CONTENT_HASHED_URI, DEFAULT_MERKLE_ROOT, DEFAULT_MERKLE_TREE_CONTENT_HASHED_URI, DEFAULT_START_BLOCK, DEFAULT_NUMBER_OF_BLOCKS, DEFAULT_QUESTION_COUNT)
            await tx.wait()

            processIdExpected = await contractInstance.getProcessId(randomAccount1.address, 1)
            processIdActual = await contractInstance.getNextProcessId(randomAccount1.address)
            expect(processIdExpected).to.eq(processIdActual)

            contractInstance = contractInstance.connect(randomAccount2.wallet) as any
            tx = await contractInstance.create(ProcessMode.make({ scheduled: true }), ProcessEnvelopeType.make({}), DEFAULT_METADATA_CONTENT_HASHED_URI, DEFAULT_MERKLE_ROOT, DEFAULT_MERKLE_TREE_CONTENT_HASHED_URI, DEFAULT_START_BLOCK, DEFAULT_NUMBER_OF_BLOCKS, DEFAULT_QUESTION_COUNT)
            await tx.wait()

            processIdExpected = await contractInstance.getProcessId(randomAccount2.address, 1)
            processIdActual = await contractInstance.getNextProcessId(randomAccount2.address)
            expect(processIdExpected).to.eq(processIdActual)
        })
        it("should emit an event", async () => {
            const expectedProcessId = await contractInstance.getProcessId(entityAccount.address, 0)

            // One has already been created by the builder

            const result: { entityAddress: string, processId: string } = await new Promise((resolve, reject) => {
                contractInstance.on("ProcessCreated", (entityAddress: string, processId: string) => {
                    resolve({ entityAddress, processId })
                })
                // contractInstance.create(ProcessMode.make({ scheduled: true }), ProcessEnvelopeType.make({}), DEFAULT_METADATA_CONTENT_HASHED_URI, DEFAULT_MERKLE_ROOT, DEFAULT_MERKLE_TREE_CONTENT_HASHED_URI, DEFAULT_START_BLOCK, DEFAULT_NUMBER_OF_BLOCKS, DEFAULT_QUESTION_COUNT).then(tx => tx.wait()).catch(reject)
            })

            expect(result).to.be.ok
            expect(result.entityAddress).to.equal(entityAccount.address)
            expect(result.processId).to.equal(expectedProcessId)
        }).timeout(7000)

        it("should increase the processCount of the entity on success", async () => {
            const prev = Number(await contractInstance.entityProcessCount(entityAccount.address))
            expect(prev).to.eq(1)

            tx = await contractInstance.create(ProcessMode.make({ scheduled: true }), ProcessEnvelopeType.make({}), DEFAULT_METADATA_CONTENT_HASHED_URI, DEFAULT_MERKLE_ROOT, DEFAULT_MERKLE_TREE_CONTENT_HASHED_URI, DEFAULT_START_BLOCK, DEFAULT_NUMBER_OF_BLOCKS, DEFAULT_QUESTION_COUNT)
            await tx.wait()

            const current = Number(await contractInstance.entityProcessCount(entityAccount.address))

            expect(current).to.eq(prev + 1, "processCount should have increased by 1")
        })

        it("should fail if blockCount is zero")

        it("should not increase the processCount of the entity on error", async () => {
            const prev = Number(await contractInstance.entityProcessCount(entityAccount.address))
            expect(prev).to.eq(1)

            try {
                tx = await contractInstance.create(ProcessMode.make({}), ProcessEnvelopeType.make({}), "", "", "", 0, 0, 10)
                await tx.wait()

                throw new Error("The transaction should have thrown an error but didn't")
            }
            catch (err) {
                expect(err.message).to.match(/revert/, "The transaction threw an unexpected error:\n" + err.message)
            }

            const current = Number(await contractInstance.entityProcessCount(entityAccount.address))

            expect(current).to.eq(prev, "processCount should not have changed")
        })
        it("retrieved metadata should match the one submitted", async () => {
            // 1
            tx = await contractInstance.create(ProcessMode.make({}), ProcessEnvelopeType.make({}), DEFAULT_METADATA_CONTENT_HASHED_URI, DEFAULT_MERKLE_ROOT, DEFAULT_MERKLE_TREE_CONTENT_HASHED_URI, DEFAULT_START_BLOCK, DEFAULT_NUMBER_OF_BLOCKS, DEFAULT_QUESTION_COUNT)
            await tx.wait()

            let count = Number(await contractInstance.entityProcessCount(entityAccount.address))
            let processId = await contractInstance.getProcessId(entityAccount.address, count - 1)

            let processData = await contractInstance.get(processId)

            expect(processData.mode).to.eq(ProcessMode.make({}))
            expect(processData.envelopeType).to.eq(ProcessEnvelopeType.make({}))
            expect(processData.entityAddress).to.eq(entityAccount.address)
            expect(processData.metadata).to.eq(DEFAULT_METADATA_CONTENT_HASHED_URI)
            expect(processData.censusMerkleRoot).to.eq(DEFAULT_MERKLE_ROOT)
            expect(processData.censusMerkleTree).to.eq(DEFAULT_MERKLE_TREE_CONTENT_HASHED_URI)
            expect(processData.status).to.eq(ProcessStatus.PAUSED, "The process should start paused")
            expect(processData.startBlock.toNumber()).to.eq(DEFAULT_START_BLOCK)
            expect(processData.blockCount.toNumber()).to.eq(DEFAULT_NUMBER_OF_BLOCKS)

            // 2
            let newMetadata = "ipfs://ipfs/more-hash-there!sha3-hash"
            let censusMerkleRoot = "0x00000001111122222333334444"
            let censusMerkleTree = "ipfs://ipfs/more-hash-somewthere!sha3-hash-there"
            let startBlock = 23456789
            let blockCount = 1000
            let questionCount = 10

            tx = await contractInstance.create(ProcessMode.make({ scheduled: true }), ProcessEnvelopeType.make({ encryptedVotes: true }), newMetadata, censusMerkleRoot, censusMerkleTree, startBlock, blockCount, questionCount)
            await tx.wait()

            count = Number(await contractInstance.entityProcessCount(entityAccount.address))
            processId = await contractInstance.getProcessId(entityAccount.address, count - 1)

            processData = await contractInstance.get(processId)

            expect(processData.mode).to.eq(ProcessMode.make({ scheduled: true }))
            expect(processData.envelopeType).to.eq(ProcessEnvelopeType.make({ encryptedVotes: true }))
            expect(processData.entityAddress).to.eq(entityAccount.address)
            expect(processData.metadata).to.eq(newMetadata)
            expect(processData.censusMerkleRoot).to.eq(censusMerkleRoot)
            expect(processData.censusMerkleTree).to.eq(censusMerkleTree)
            expect(processData.status).to.eq(ProcessStatus.OPEN, "The process should start as open")
            expect(processData.startBlock.toNumber()).to.eq(startBlock)
            expect(processData.blockCount.toNumber()).to.eq(blockCount)
        })
    })

    describe("should add a validator", () => {
        const validatorPublicKey = "0x1234"
        const validatorPublicKey2 = "0x4321"

        it("only when the contract owner requests it", async () => {
            expect(await contractInstance.isValidator(validatorPublicKey)).to.be.false

            // Register a validator
            contractInstance = contractInstance.connect(deployAccount.wallet) as any
            tx = await contractInstance.addValidator(validatorPublicKey)
            await tx.wait()

            // Get validator list
            const result2 = await contractInstance.getValidators()
            expect(result2.length).to.eq(1)
            expect(result2).to.deep.eq([validatorPublicKey])

            // Check validator
            expect(await contractInstance.isValidator(validatorPublicKey)).to.be.true

            // Attempt to add a validator by someone else
            try {
                contractInstance = contractInstance.connect(randomAccount1.wallet) as any
                tx = await contractInstance.addValidator(validatorPublicKey2)
                await tx.wait()
                throw new Error("The transaction should have thrown an error but didn't")
            }
            catch (err) {
                expect(err.message).to.match(/revert/, "The transaction threw an unexpected error:\n" + err.message)
            }

            // Get validator list
            const result3 = await contractInstance.getValidators()
            expect(result3.length).to.eq(1)
            expect(result3).to.deep.eq([validatorPublicKey])

            // Check validator
            expect(await contractInstance.isValidator(validatorPublicKey2)).to.be.false
        })

        it("should add the validator public key to the validator list", async () => {
            // Register validator 1
            contractInstance = contractInstance.connect(deployAccount.wallet) as any
            tx = await contractInstance.addValidator(validatorPublicKey)
            await tx.wait()

            // Get validator list
            const result2 = await contractInstance.getValidators()
            expect(result2.length).to.eq(1)
            expect(result2).to.deep.eq([validatorPublicKey])

            // Check validator
            expect(await contractInstance.isValidator(validatorPublicKey)).to.be.true

            // Adding validator #2
            contractInstance = contractInstance.connect(deployAccount.wallet) as any
            tx = await contractInstance.addValidator(validatorPublicKey2)
            await tx.wait()

            // Get validator list
            const result4 = await contractInstance.getValidators()
            expect(result4.length).to.eq(2)
            expect(result4).to.deep.eq([validatorPublicKey, validatorPublicKey2])

            // Check validator
            expect(await contractInstance.isValidator(validatorPublicKey2)).to.be.true
        })

        it("should not add the validator public key to the validator list if exists", async () => {
            // Register validator 1
            contractInstance = contractInstance.connect(deployAccount.wallet) as any
            tx = await contractInstance.addValidator(validatorPublicKey)
            await tx.wait()

            // Get validator list
            const result2 = await contractInstance.getValidators()
            expect(result2.length).to.eq(1)
            expect(result2).to.deep.eq([validatorPublicKey])

            // Adding validator #2
            try {
                contractInstance = contractInstance.connect(deployAccount.wallet) as any
                tx = await contractInstance.addValidator(validatorPublicKey)
                await tx.wait()
                throw new Error("The transaction should have thrown an error but didn't")
            } catch (err) {
                expect(err.message).to.match(/revert/, "The transaction threw an unexpected error:\n" + err.message)
            }

            // Get validator list
            const result3 = await contractInstance.getValidators()
            expect(result3).to.deep.eq([validatorPublicKey])
            expect(result3.length).to.eq(1)

            // Still valid
            expect(await contractInstance.isValidator(validatorPublicKey)).to.be.true
        })

        it("should emit an event", async () => {
            // Register validator
            contractInstance = contractInstance.connect(deployAccount.wallet) as any

            const result: { validatorPublicKey: string } = await new Promise((resolve, reject) => {
                contractInstance.on("ValidatorAdded", (validatorPublicKey: string) => {
                    resolve({ validatorPublicKey })
                })
                contractInstance.addValidator(validatorPublicKey).then(tx => tx.wait()).catch(reject)
            })

            expect(result).to.be.ok
            expect(result.validatorPublicKey).to.equal(validatorPublicKey)
        }).timeout(7000)
    })

    describe("should remove a validator", () => {

        const validatorPublicKey = "0x1234"

        it("only when the contract owner account requests it", async () => {
            contractInstance = contractInstance.connect(deployAccount.wallet) as any
            tx = await contractInstance.addValidator(validatorPublicKey)
            await tx.wait()

            // Get validator list
            const result1 = await contractInstance.getValidators()
            expect(result1.length).to.eq(1)

            // Attempt to disable the validator from someone else
            try {
                contractInstance = contractInstance.connect(randomAccount1.wallet) as any
                tx = await contractInstance.removeValidator(0, validatorPublicKey)
                await tx.wait()
                throw new Error("The transaction should have thrown an error but didn't")
            }
            catch (err) {
                expect(err.message).to.match(/revert/, "The transaction threw an unexpected error:\n" + err.message)
            }

            // Get validator list
            const result2 = await contractInstance.getValidators()
            expect(result2.length).to.eq(1)
            expect(result2).to.deep.eq([validatorPublicKey])

            // Check validator
            expect(await contractInstance.isValidator(validatorPublicKey)).to.be.true

            // Disable validator from the owner
            contractInstance = contractInstance.connect(deployAccount.wallet) as any
            tx = await contractInstance.removeValidator(0, validatorPublicKey)
            await tx.wait()

            // Get validator list
            const result4 = await contractInstance.getValidators()
            expect(result4.length).to.eq(0)
            expect(result4).to.deep.eq([])
        })

        it("should fail if the idx does not match validatorPublicKey", async () => {
            const nonExistingValidatorPublicKey = "0x123123"

            contractInstance = contractInstance.connect(deployAccount.wallet) as any

            // Register a validator
            tx = await contractInstance.addValidator(validatorPublicKey)
            await tx.wait()

            // Attempt to disable mismatching validator
            try {
                contractInstance = contractInstance.connect(randomAccount1.wallet) as any
                tx = await contractInstance.removeValidator(0, nonExistingValidatorPublicKey)
                await tx.wait()
                throw new Error("The transaction should have thrown an error but didn't")
            }
            catch (err) {
                expect(err.message).to.match(/revert/, "The transaction threw an unexpected error:\n" + err.message)
            }

            // Get validator list
            expect(await contractInstance.getValidators()).to.deep.eq([validatorPublicKey])

            // Check validators
            expect(await contractInstance.isValidator(validatorPublicKey)).to.be.true
            expect(await contractInstance.isValidator(nonExistingValidatorPublicKey)).to.be.false

            // Attempt to disable non-existing validator
            try {
                contractInstance = contractInstance.connect(randomAccount1.wallet) as any
                tx = await contractInstance.removeValidator(5, validatorPublicKey)
                await tx.wait()
                throw new Error("The transaction should have thrown an error but didn't")
            }
            catch (err) {
                expect(err.message).to.match(/revert/, "The transaction threw an unexpected error:\n" + err.message)
            }

            // Get validator list
            const result4 = await contractInstance.getValidators()
            expect(result4.length).to.eq(1)
            expect(result4).to.deep.eq([validatorPublicKey])

            // Check validator
            expect(await contractInstance.isValidator(validatorPublicKey)).to.be.true
        })

        it("should emit an event", async () => {
            // Register validator
            contractInstance = contractInstance.connect(deployAccount.wallet) as any
            tx = await contractInstance.addValidator(validatorPublicKey)
            await tx.wait()

            const result: { validatorPublicKey: string } = await new Promise((resolve, reject) => {
                contractInstance.on("ValidatorRemoved", (validatorPublicKey: string) => {
                    resolve({ validatorPublicKey })
                })
                contractInstance.removeValidator(0, validatorPublicKey).then(tx => tx.wait()).catch(reject)
            })

            expect(result).to.be.ok
            expect(result.validatorPublicKey).to.equal(validatorPublicKey)
        }).timeout(7000)
    })

    describe("should register an oracle", () => {

        it("only when the contract owner requests it", async () => {
            // Check validator
            expect(await contractInstance.isOracle(authorizedOracleAccount1.address)).to.be.false

            // Register a oracle
            contractInstance = contractInstance.connect(deployAccount.wallet) as any
            tx = await contractInstance.addOracle(authorizedOracleAccount1.address)
            await tx.wait()

            // Get oracle list
            const result2 = await contractInstance.getOracles()
            expect(result2.length).to.eq(1)
            expect(result2).to.deep.eq([authorizedOracleAccount1.address])

            // Check oracle
            expect(await contractInstance.isOracle(authorizedOracleAccount1.address)).to.be.true

            // Attempt to add a oracle by someone else
            try {
                contractInstance = contractInstance.connect(randomAccount2.wallet) as any
                tx = await contractInstance.addOracle(authorizedOracleAccount2.address)
                await tx.wait()
                throw new Error("The transaction should have thrown an error but didn't")
            }
            catch (err) {
                expect(err.message).to.match(/revert/, "The transaction threw an unexpected error:\n" + err.message)
            }

            // Get oracle list
            const result3 = await contractInstance.getOracles()
            expect(result3.length).to.eq(1)
            expect(result3).to.deep.eq([authorizedOracleAccount1.address])

            // Check oracle
            expect(await contractInstance.isOracle(authorizedOracleAccount1.address)).to.be.true
            expect(await contractInstance.isOracle(authorizedOracleAccount2.address)).to.be.false
        })

        it("should add the oracle address to the oracle list", async () => {
            // Register oracle 1
            contractInstance = contractInstance.connect(deployAccount.wallet) as any
            tx = await contractInstance.addOracle(authorizedOracleAccount1.address)
            await tx.wait()

            // Get oracle list
            const result2 = await contractInstance.getOracles()
            expect(result2.length).to.eq(1)
            expect(result2).to.deep.eq([authorizedOracleAccount1.address])

            // Check oracle
            expect(await contractInstance.isOracle(authorizedOracleAccount1.address)).to.be.true

            // Adding oracle #2
            contractInstance = contractInstance.connect(deployAccount.wallet) as any
            tx = await contractInstance.addOracle(authorizedOracleAccount2.address)
            await tx.wait()

            // Get oracle list
            const result4 = await contractInstance.getOracles()
            expect(result4.length).to.eq(2)
            expect(result4).to.deep.eq([authorizedOracleAccount1.address, authorizedOracleAccount2.address])

            // Check oracle
            expect(await contractInstance.isOracle(authorizedOracleAccount1.address)).to.be.true
            expect(await contractInstance.isOracle(authorizedOracleAccount2.address)).to.be.true
        })

        it("should not add the oracle address to the oracle list if exists", async () => {
            // Register oracle 1
            contractInstance = contractInstance.connect(deployAccount.wallet) as any
            tx = await contractInstance.addOracle(authorizedOracleAccount1.address)
            await tx.wait()

            // Get oracle list
            const result2 = await contractInstance.getOracles()
            expect(result2.length).to.eq(1)
            expect(result2).to.deep.eq([authorizedOracleAccount1.address])

            // Check oracle
            expect(await contractInstance.isOracle(authorizedOracleAccount1.address)).to.be.true

            // Adding oracle #2
            try {
                contractInstance = contractInstance.connect(deployAccount.wallet) as any
                tx = await contractInstance.addOracle(authorizedOracleAccount1.address)
                await tx.wait()
                throw new Error("The transaction should have thrown an error but didn't")
            } catch (err) {
                expect(err.message).to.match(/revert/, "The transaction threw an unexpected error:\n" + err.message)
            }

            // Get oracle list
            const result3 = await contractInstance.getOracles()
            expect(result3.length).to.eq(1)
            expect(result3).to.deep.eq([authorizedOracleAccount1.address])

            // Check oracle
            expect(await contractInstance.isOracle(authorizedOracleAccount1.address)).to.be.true
        })

        it("should emit an event", async () => {
            contractInstance = contractInstance.connect(deployAccount.wallet) as any

            const result: { oracleAddress: string } = await new Promise((resolve, reject) => {
                contractInstance.on("OracleAdded", (oracleAddress: string) => {
                    resolve({ oracleAddress })
                })
                contractInstance.addOracle(authorizedOracleAccount1.address).then(tx => tx.wait()).catch(reject)
            })

            expect(result).to.be.ok
            expect(result.oracleAddress).to.equal(authorizedOracleAccount1.address)
        }).timeout(7000)
    })

    describe("should remove an oracle", () => {

        it("only when the contract owner requests it", async () => {
            // Check oracle
            expect(await contractInstance.isOracle(authorizedOracleAccount1.address)).to.be.false

            // Register oracle
            contractInstance = contractInstance.connect(deployAccount.wallet) as any
            tx = await contractInstance.addOracle(authorizedOracleAccount1.address)
            await tx.wait()

            // Check oracle
            expect(await contractInstance.isOracle(authorizedOracleAccount1.address)).to.be.true

            // Attempt to disable the oracle from someone else
            try {
                contractInstance = contractInstance.connect(randomAccount2.wallet) as any
                tx = await contractInstance.removeOracle(0, authorizedOracleAccount1.address)
                throw new Error("The transaction should have thrown an error but didn't")
            }
            catch (err) {
                expect(err.message).to.match(/revert/, "The transaction threw an unexpected error:\n" + err.message)
            }

            // Get oracle list
            const result2 = await contractInstance.getOracles()
            expect(result2.length).to.eq(1)
            expect(result2).to.deep.eq([authorizedOracleAccount1.address])

            // Check oracle
            expect(await contractInstance.isOracle(authorizedOracleAccount1.address)).to.be.true

            // Disable oracle from the creator
            contractInstance = contractInstance.connect(deployAccount.wallet) as any
            const result3 = await contractInstance.removeOracle(0, authorizedOracleAccount1.address)

            // Get oracle list
            const result4 = await contractInstance.getOracles()
            expect(result4.length).to.eq(0)
            expect(result4).to.deep.eq([])

            // Check oracle
            expect(await contractInstance.isOracle(authorizedOracleAccount1.address)).to.be.false
        })

        it("should fail if the idx is not valid", async () => {
            // Check oracle
            expect(await contractInstance.isOracle(authorizedOracleAccount1.address)).to.be.false

            // Register a oracle
            contractInstance = contractInstance.connect(deployAccount.wallet) as any
            tx = await contractInstance.addOracle(authorizedOracleAccount1.address)
            await tx.wait()

            // Register a oracle
            contractInstance = contractInstance.connect(deployAccount.wallet) as any
            tx = await contractInstance.addOracle(authorizedOracleAccount2.address)
            await tx.wait()

            // Attempt to disable non-existing oracle
            try {
                contractInstance = contractInstance.connect(deployAccount.wallet) as any
                tx = await contractInstance.removeOracle(5, authorizedOracleAccount2.address)
                throw new Error("The transaction should have thrown an error but didn't")
            }
            catch (err) {
                expect(err.message).to.match(/revert/, "The transaction threw an unexpected error:\n" + err.message)
            }

            // Get oracle list
            const result3 = await contractInstance.getOracles()
            expect(result3.length).to.eq(2)
            expect(result3).to.deep.eq([authorizedOracleAccount1.address, authorizedOracleAccount2.address])

            // Check oracle
            expect(await contractInstance.isOracle(authorizedOracleAccount1.address)).to.be.true
            expect(await contractInstance.isOracle(authorizedOracleAccount1.address)).to.be.true
        })

        it("should fail if the idx does not match oracleAddress", async () => {
            // Register a oracle
            contractInstance = contractInstance.connect(deployAccount.wallet) as any
            tx = await contractInstance.addOracle(authorizedOracleAccount1.address)
            await tx.wait()

            // Register a oracle
            contractInstance = contractInstance.connect(deployAccount.wallet) as any
            tx = await contractInstance.addOracle(authorizedOracleAccount2.address)
            await tx.wait()

            // Attempt to disable non-existing oracle
            try {
                contractInstance = contractInstance.connect(deployAccount.wallet) as any
                tx = await contractInstance.removeOracle(1, randomAccount2.address)
                throw new Error("The transaction should have thrown an error but didn't")
            }
            catch (err) {
                expect(err.message).to.match(/revert/, "The transaction threw an unexpected error:\n" + err.message)
            }

            // Get oracle list
            const result4 = await contractInstance.getOracles()
            expect(result4.length).to.eq(2)
            expect(result4).to.deep.eq([authorizedOracleAccount1.address, authorizedOracleAccount2.address])

            // Check oracle
            expect(await contractInstance.isOracle(authorizedOracleAccount1.address)).to.be.true
            expect(await contractInstance.isOracle(authorizedOracleAccount1.address)).to.be.true
        })

        it("should emit an event", async () => {
            contractInstance = contractInstance.connect(deployAccount.wallet) as any

            // Register oracle
            tx = await contractInstance.addOracle(authorizedOracleAccount1.address)
            await tx.wait()

            const result: { oracleAddress: string } = await new Promise((resolve, reject) => {
                contractInstance.on("OracleRemoved", (oracleAddress: string) => {
                    resolve({ oracleAddress })
                })
                contractInstance.removeOracle(0, authorizedOracleAccount1.address).then(tx => tx.wait()).catch(reject)
            })

            expect(result).to.be.ok
            expect(result.oracleAddress).to.equal(authorizedOracleAccount1.address)
        }).timeout(7000)
    })

    describe("Process Status", () => {
        beforeEach(async () => {
            contractInstance = await new ProcessBuilder().withMode(ProcessMode.make({ scheduled: true })).build()
        })

        it("should create paused processes by default", async () => {
            contractInstance = await new ProcessBuilder().withMode(ProcessMode.make()).build()
            const processId1 = await contractInstance.getProcessId(entityAccount.address, 0)

            // one is already created by the builder

            const processData0 = await contractInstance.get(processId1)
            expect(processData0.status).to.eq(ProcessStatus.PAUSED, "The process should be paused")
        })

        it("should create open processes when scheduled", async () => {
            const processId1 = await contractInstance.getNextProcessId(entityAccount.address)

            tx = await contractInstance.create(ProcessMode.make({ scheduled: true }), ProcessEnvelopeType.make(), DEFAULT_METADATA_CONTENT_HASHED_URI, DEFAULT_MERKLE_ROOT, DEFAULT_MERKLE_TREE_CONTENT_HASHED_URI, DEFAULT_START_BLOCK, DEFAULT_NUMBER_OF_BLOCKS, DEFAULT_QUESTION_COUNT)

            const processData0 = await contractInstance.get(processId1)
            expect(processData0.status).to.eq(ProcessStatus.OPEN, "The process should be open")
        })

        describe("processes should end", () => {
            it("only when the entity account requests it", async () => {
                const processId1 = await contractInstance.getProcessId(entityAccount.address, 0)

                // one is already created by the builder

                const processData0 = await contractInstance.get(processId1)
                expect(processData0.status).to.eq(ProcessStatus.OPEN, "The process should now be ended")

                // End it
                contractInstance = contractInstance.connect(entityAccount.wallet) as any
                tx = await contractInstance.setStatus(processId1, ProcessStatus.ENDED)
                await tx.wait()

                const processData1 = await contractInstance.get(processId1)
                expect(processData1.mode).to.eq(ProcessMode.make({ scheduled: true }))
                expect(processData1.envelopeType).to.eq(ProcessEnvelopeType.make())
                expect(processData1.entityAddress).to.eq(entityAccount.address)
                expect(processData1.metadata).to.eq(DEFAULT_METADATA_CONTENT_HASHED_URI)
                expect(processData1.status).to.eq(ProcessStatus.ENDED, "The process should now be ended")

                // Create second one
                const processId2 = await contractInstance.getProcessId(entityAccount.address, 1)
                tx = await contractInstance.create(ProcessMode.make({ scheduled: true }), ProcessEnvelopeType.make(), DEFAULT_METADATA_CONTENT_HASHED_URI, DEFAULT_MERKLE_ROOT, DEFAULT_MERKLE_TREE_CONTENT_HASHED_URI, DEFAULT_START_BLOCK, DEFAULT_NUMBER_OF_BLOCKS, DEFAULT_QUESTION_COUNT)
                await tx.wait()

                // Try to end it from another account
                try {
                    contractInstance = contractInstance.connect(randomAccount1.wallet) as any
                    tx = await contractInstance.setStatus(processId2, ProcessStatus.ENDED)
                    await tx.wait()
                    throw new Error("The transaction should have thrown an error but didn't")
                }
                catch (err) {
                    expect(err.message).to.match(/revert/, "The transaction threw an unexpected error:\n" + err.message)
                }

                const processData2 = await contractInstance.get(processId2)
                expect(processData2.mode).to.eq(ProcessMode.make({ scheduled: true }))
                expect(processData2.envelopeType).to.eq(ProcessEnvelopeType.make())
                expect(processData2.entityAddress).to.eq(entityAccount.address)
                expect(processData2.metadata).to.eq(DEFAULT_METADATA_CONTENT_HASHED_URI)
                expect(processData2.status).to.eq(ProcessStatus.OPEN, "The process should remain open")
            })

            it("if not yet ended", async () => {
                const processId1 = await contractInstance.getProcessId(entityAccount.address, 0)

                // one is already created by the builder

                const processData0 = await contractInstance.get(processId1)
                expect(processData0.status).to.eq(ProcessStatus.OPEN, "The process should be open")

                // Ended by the creator
                contractInstance = contractInstance.connect(entityAccount.wallet) as any
                tx = await contractInstance.setStatus(processId1, ProcessStatus.ENDED)
                await tx.wait()

                const processData1 = await contractInstance.get(processId1)
                expect(processData1.mode).to.eq(ProcessMode.make({ scheduled: true }))
                expect(processData1.envelopeType).to.eq(ProcessEnvelopeType.make())
                expect(processData1.entityAddress).to.eq(entityAccount.address)
                expect(processData1.metadata).to.eq(DEFAULT_METADATA_CONTENT_HASHED_URI)
                expect(processData1.status).to.eq(ProcessStatus.ENDED, "The process should now be ended")

                // Try to end again
                try {
                    contractInstance = contractInstance.connect(entityAccount.wallet) as any
                    tx = await contractInstance.setStatus(processId1, ProcessStatus.ENDED)
                    await tx.wait()
                    throw new Error("The transaction should have thrown an error but didn't")
                }
                catch (err) {
                    expect(err.message).to.match(/revert/, "The transaction threw an unexpected error:\n" + err.message)
                }

                // Nothing else should have changed
                const processData2 = await contractInstance.get(processId1)
                expect(processData2.entityAddress).to.eq(entityAccount.address)
                expect(processData2.metadata).to.eq(DEFAULT_METADATA_CONTENT_HASHED_URI)
                expect(processData2.status).to.eq(ProcessStatus.ENDED, "The process should remain ended")
            })

            it("if it not canceled", async () => {
                const processId1 = await contractInstance.getProcessId(entityAccount.address, 0)

                // one is already created by the builder

                const processData0 = await contractInstance.get(processId1)
                expect(processData0.status).to.eq(ProcessStatus.OPEN, "The process should be open")

                // Canceled by the creator
                contractInstance = contractInstance.connect(entityAccount.wallet) as any
                tx = await contractInstance.setStatus(processId1, ProcessStatus.CANCELED)
                await tx.wait()

                const processData1 = await contractInstance.get(processId1)
                expect(processData1.mode).to.eq(ProcessMode.make({ scheduled: true }))
                expect(processData1.envelopeType).to.eq(ProcessEnvelopeType.make())
                expect(processData1.entityAddress).to.eq(entityAccount.address)
                expect(processData1.metadata).to.eq(DEFAULT_METADATA_CONTENT_HASHED_URI)
                expect(processData1.status).to.eq(ProcessStatus.CANCELED, "The process should now be canceled")

                // Try to end it
                try {
                    contractInstance = contractInstance.connect(entityAccount.wallet) as any
                    tx = await contractInstance.setStatus(processId1, ProcessStatus.ENDED)
                    await tx.wait()
                    throw new Error("The transaction should have thrown an error but didn't")
                }
                catch (err) {
                    expect(err.message).to.match(/revert/, "The transaction threw an unexpected error:\n" + err.message)
                }

                // Nothing else should have changed
                const processData2 = await contractInstance.get(processId1)
                expect(processData2.entityAddress).to.eq(entityAccount.address)
                expect(processData2.metadata).to.eq(DEFAULT_METADATA_CONTENT_HASHED_URI)
                expect(processData2.status).to.eq(ProcessStatus.CANCELED, "The process should remain canceled")
            })

            it("should emit an event", async () => {
                const processId1 = await contractInstance.getProcessId(entityAccount.address, 0)

                // one is already created by the builder

                const result: { entityAddress: string, processId: string, newStatus: string } = await new Promise((resolve, reject) => {
                    contractInstance.on("StatusUpdated", (entityAddress: string, processId: string, newStatus: string) => {
                        resolve({ entityAddress, processId, newStatus })
                    })
                    contractInstance.setStatus(processId1, ProcessStatus.ENDED).then(tx => tx.wait()).catch(reject)
                })

                expect(result).to.be.ok
                expect(result.entityAddress).to.equal(entityAccount.address)
                expect(result.processId).to.equal(processId1)
                expect(result.newStatus).to.equal(ProcessStatus.ENDED)
            }).timeout(7000)
        })

        describe("processes should cancel", () => {
            it("only when the entity account requests it", async () => {
                const processId1 = await contractInstance.getProcessId(entityAccount.address, 0)

                // one is already created by the builder

                const processData0 = await contractInstance.get(processId1)
                expect(processData0.status).to.eq(ProcessStatus.OPEN)

                // Canceled by the creator
                contractInstance = contractInstance.connect(entityAccount.wallet) as any
                tx = await contractInstance.setStatus(processId1, ProcessStatus.CANCELED)
                await tx.wait()

                const processData1 = await contractInstance.get(processId1)
                expect(processData1.mode).to.eq(ProcessMode.make({ scheduled: true }))
                expect(processData1.envelopeType).to.eq(ProcessEnvelopeType.make())
                expect(processData1.entityAddress).to.eq(entityAccount.address)
                expect(processData1.metadata).to.eq(DEFAULT_METADATA_CONTENT_HASHED_URI)
                expect(processData1.status).to.eq(ProcessStatus.CANCELED, "The process should now be canceled")

                // Create another one
                const processId2 = await contractInstance.getProcessId(entityAccount.address, 1)
                tx = await contractInstance.create(ProcessMode.make({ scheduled: true }), ProcessEnvelopeType.make(), DEFAULT_METADATA_CONTENT_HASHED_URI, DEFAULT_MERKLE_ROOT, DEFAULT_MERKLE_TREE_CONTENT_HASHED_URI, DEFAULT_START_BLOCK, DEFAULT_NUMBER_OF_BLOCKS, DEFAULT_QUESTION_COUNT)
                await tx.wait()

                // Try to cancel from another account
                try {
                    contractInstance = contractInstance.connect(randomAccount1.wallet) as any
                    tx = await contractInstance.setStatus(processId2, 2)
                    await tx.wait()
                    throw new Error("The transaction should have thrown an error but didn't")
                }
                catch (err) {
                    expect(err.message).to.match(/revert/, "The transaction threw an unexpected error:\n" + err.message)
                }

                const processData2 = await contractInstance.get(processId2)
                expect(processData2.mode).to.eq(ProcessMode.make({ scheduled: true }))
                expect(processData2.envelopeType).to.eq(ProcessEnvelopeType.make())
                expect(processData2.entityAddress).to.eq(entityAccount.address)
                expect(processData2.metadata).to.eq(DEFAULT_METADATA_CONTENT_HASHED_URI)
                expect(processData2.status).to.eq(ProcessStatus.OPEN, "The process should remain open")

            })
            it("if not yet canceled", async () => {
                const processId1 = await contractInstance.getProcessId(entityAccount.address, 0)

                // one is already created by the builder

                // Canceled by the creator
                contractInstance = contractInstance.connect(entityAccount.wallet) as any
                tx = await contractInstance.setStatus(processId1, ProcessStatus.CANCELED)
                await tx.wait()

                const processData1 = await contractInstance.get(processId1)
                expect(processData1.mode).to.eq(ProcessMode.make({ scheduled: true }))
                expect(processData1.envelopeType).to.eq(ProcessEnvelopeType.make())
                expect(processData1.entityAddress).to.eq(entityAccount.address)
                expect(processData1.metadata).to.eq(DEFAULT_METADATA_CONTENT_HASHED_URI)
                expect(processData1.status).to.eq(ProcessStatus.CANCELED, "The process should now be canceled")

                // Try to cancel again
                try {
                    contractInstance = contractInstance.connect(entityAccount.wallet) as any
                    tx = await contractInstance.setStatus(processId1, ProcessStatus.CANCELED)
                    await tx.wait()
                    throw new Error("The transaction should have thrown an error but didn't")
                }
                catch (err) {
                    expect(err.message).to.match(/revert/, "The transaction threw an unexpected error:\n" + err.message)
                }

                // Nothing else should have changed
                const processData2 = await contractInstance.get(processId1)
                expect(processData2.entityAddress).to.eq(entityAccount.address)
                expect(processData2.metadata).to.eq(DEFAULT_METADATA_CONTENT_HASHED_URI)
                expect(processData2.status).to.eq(ProcessStatus.CANCELED, "The process should now be canceled")
            })

            it("if not yet ended", async () => {
                const processId1 = await contractInstance.getProcessId(entityAccount.address, 0)

                // one is already created by the builder

                // Ended by the creator
                contractInstance = contractInstance.connect(entityAccount.wallet) as any
                tx = await contractInstance.setStatus(processId1, 1)
                await tx.wait()

                const processData1 = await contractInstance.get(processId1)
                expect(processData1.mode).to.eq(ProcessMode.make({ scheduled: true }))
                expect(processData1.envelopeType).to.eq(ProcessEnvelopeType.make())
                expect(processData1.entityAddress).to.eq(entityAccount.address)
                expect(processData1.metadata).to.eq(DEFAULT_METADATA_CONTENT_HASHED_URI)
                expect(processData1.status).to.eq(ProcessStatus.ENDED, "The process should now be ended")

                // Try to cancel
                try {
                    contractInstance = contractInstance.connect(entityAccount.wallet) as any
                    tx = await contractInstance.setStatus(processId1, ProcessStatus.CANCELED)
                    await tx.wait()
                    throw new Error("The transaction should have thrown an error but didn't")
                }
                catch (err) {
                    expect(err.message).to.match(/revert/, "The transaction threw an unexpected error:\n" + err.message)
                }

                // Nothing else should have changed
                const processData2 = await contractInstance.get(processId1)
                expect(processData2.entityAddress).to.eq(entityAccount.address)
                expect(processData2.metadata).to.eq(DEFAULT_METADATA_CONTENT_HASHED_URI)
                expect(processData2.status).to.eq(ProcessStatus.ENDED, "The process should remain ended")
            })

            it("should emit an event", async () => {
                const processId1 = await contractInstance.getProcessId(entityAccount.address, 0)

                // one is already created by the builder

                const result: { entityAddress: string, processId: string, newStatus: string } = await new Promise((resolve, reject) => {
                    contractInstance.on("StatusUpdated", (entityAddress: string, processId: string, newStatus: string) => {
                        resolve({ entityAddress, processId, newStatus })
                    })
                    contractInstance.setStatus(processId1, ProcessStatus.CANCELED).then(tx => tx.wait()).catch(reject)
                })

                expect(result).to.be.ok
                expect(result.entityAddress).to.equal(entityAccount.address)
                expect(result.processId).to.equal(processId1)
                expect(result.newStatus).to.equal(ProcessStatus.CANCELED)
            }).timeout(7000)
        })

        describe("processes should pause", () => {

            it("only if the entity account requests it", async () => {
                const processId1 = await contractInstance.getProcessId(entityAccount.address, 0)

                // one is already created by the builder

                // Paused by the creator
                // contractInstance = contractInstance.connect(entityAccount.wallet) as any
                tx = await contractInstance.setStatus(processId1, ProcessStatus.PAUSED)
                await tx.wait()

                const processData1 = await contractInstance.get(processId1)
                expect(processData1.mode).to.eq(ProcessMode.make({ scheduled: true }))
                expect(processData1.envelopeType).to.eq(ProcessEnvelopeType.make())
                expect(processData1.entityAddress).to.eq(entityAccount.address)
                expect(processData1.metadata).to.eq(DEFAULT_METADATA_CONTENT_HASHED_URI)
                expect(processData1.status).to.eq(ProcessStatus.PAUSED, "The process should now be paused")

                // Create another one
                const processId2 = await contractInstance.getProcessId(entityAccount.address, 1)

                tx = await contractInstance.create(ProcessMode.make({ scheduled: true }), ProcessEnvelopeType.make(), DEFAULT_METADATA_CONTENT_HASHED_URI, DEFAULT_MERKLE_ROOT, DEFAULT_MERKLE_TREE_CONTENT_HASHED_URI, DEFAULT_START_BLOCK, DEFAULT_NUMBER_OF_BLOCKS, DEFAULT_QUESTION_COUNT)
                await tx.wait()

                // Try to pause from another account
                try {
                    contractInstance = contractInstance.connect(randomAccount1.wallet) as any
                    tx = await contractInstance.setStatus(processId2, ProcessStatus.PAUSED)
                    await tx.wait()
                    throw new Error("The transaction should have thrown an error but didn't")
                }
                catch (err) {
                    expect(err.message).to.match(/revert/, "The transaction threw an unexpected error:\n" + err.message)
                }

                const processData2 = await contractInstance.get(processId2)
                expect(processData2.mode).to.eq(ProcessMode.make({ scheduled: true }))
                expect(processData2.envelopeType).to.eq(ProcessEnvelopeType.make())
                expect(processData2.entityAddress).to.eq(entityAccount.address)
                expect(processData2.metadata).to.eq(DEFAULT_METADATA_CONTENT_HASHED_URI)
                expect(processData2.status).to.eq(ProcessStatus.OPEN, "The process should remain open")
            })

            it("if not canceled", async () => {
                const processId1 = await contractInstance.getProcessId(entityAccount.address, 0)

                // one is already created by the builder

                // Canceled by the creator
                contractInstance = contractInstance.connect(entityAccount.wallet) as any
                tx = await contractInstance.setStatus(processId1, ProcessStatus.CANCELED)
                await tx.wait()

                const processData1 = await contractInstance.get(processId1)
                expect(processData1.mode).to.eq(ProcessMode.make({ scheduled: true }))
                expect(processData1.envelopeType).to.eq(ProcessEnvelopeType.make())
                expect(processData1.entityAddress).to.eq(entityAccount.address)
                expect(processData1.metadata).to.eq(DEFAULT_METADATA_CONTENT_HASHED_URI)
                expect(processData1.status).to.eq(ProcessStatus.CANCELED, "The process should now be canceled")

                // Try to pause
                try {
                    contractInstance = contractInstance.connect(entityAccount.wallet) as any
                    tx = await contractInstance.setStatus(processId1, ProcessStatus.PAUSED)
                    await tx.wait()
                    throw new Error("The transaction should have thrown an error but didn't")
                }
                catch (err) {
                    expect(err.message).to.match(/revert/, "The transaction threw an unexpected error:\n" + err.message)
                }

                // Nothing else should have changed
                const processData2 = await contractInstance.get(processId1)
                expect(processData2.entityAddress).to.eq(entityAccount.address)
                expect(processData2.metadata).to.eq(DEFAULT_METADATA_CONTENT_HASHED_URI)
                expect(processData2.status).to.eq(ProcessStatus.CANCELED, "The process should remain canceled")
            })

            it("if not ended", async () => {
                const processId1 = await contractInstance.getProcessId(entityAccount.address, 0)

                // one is already created by the builder

                // Ended by the creator
                contractInstance = contractInstance.connect(entityAccount.wallet) as any
                tx = await contractInstance.setStatus(processId1, 1)
                await tx.wait()

                const processData1 = await contractInstance.get(processId1)
                expect(processData1.mode).to.eq(ProcessMode.make({ scheduled: true }))
                expect(processData1.envelopeType).to.eq(ProcessEnvelopeType.make())
                expect(processData1.entityAddress).to.eq(entityAccount.address)
                expect(processData1.metadata).to.eq(DEFAULT_METADATA_CONTENT_HASHED_URI)
                expect(processData1.status).to.eq(ProcessStatus.ENDED, "The process should now be ended")

                // Try to pause
                try {
                    contractInstance = contractInstance.connect(entityAccount.wallet) as any
                    tx = await contractInstance.setStatus(processId1, ProcessStatus.PAUSED)
                    await tx.wait()
                    throw new Error("The transaction should have thrown an error but didn't")
                }
                catch (err) {
                    expect(err.message).to.match(/revert/, "The transaction threw an unexpected error:\n" + err.message)
                }

                // Nothing else should have changed
                const processData2 = await contractInstance.get(processId1)
                expect(processData2.entityAddress).to.eq(entityAccount.address)
                expect(processData2.metadata).to.eq(DEFAULT_METADATA_CONTENT_HASHED_URI)
                expect(processData2.status).to.eq(ProcessStatus.ENDED, "The process should remain ended")
            })

            it("if not already paused", async () => {
                const processId1 = await contractInstance.getProcessId(entityAccount.address, 0)

                // one is already created by the builder

                // Paused by the creator
                contractInstance = contractInstance.connect(entityAccount.wallet) as any
                tx = await contractInstance.setStatus(processId1, ProcessStatus.PAUSED)
                await tx.wait()

                const processData1 = await contractInstance.get(processId1)
                expect(processData1.mode).to.eq(ProcessMode.make({ scheduled: true }))
                expect(processData1.envelopeType).to.eq(ProcessEnvelopeType.make())
                expect(processData1.entityAddress).to.eq(entityAccount.address)
                expect(processData1.metadata).to.eq(DEFAULT_METADATA_CONTENT_HASHED_URI)
                expect(processData1.status).to.eq(ProcessStatus.PAUSED, "The process should now be paused")

                // Try to pause
                try {
                    contractInstance = contractInstance.connect(entityAccount.wallet) as any
                    tx = await contractInstance.setStatus(processId1, ProcessStatus.PAUSED)
                    await tx.wait()
                    throw new Error("The transaction should have thrown an error but didn't")
                }
                catch (err) {
                    expect(err.message).to.match(/revert/, "The transaction threw an unexpected error:\n" + err.message)
                }

                // Nothing else should have changed
                const processData2 = await contractInstance.get(processId1)
                expect(processData2.entityAddress).to.eq(entityAccount.address)
                expect(processData2.metadata).to.eq(DEFAULT_METADATA_CONTENT_HASHED_URI)
                expect(processData2.status).to.eq(ProcessStatus.PAUSED, "The process should be paused")
            })

            it("if opened", async () => {
                const processId1 = await contractInstance.getProcessId(entityAccount.address, 0)

                // one is already created by the builder

                // Paused by the creator
                contractInstance = contractInstance.connect(entityAccount.wallet) as any
                tx = await contractInstance.setStatus(processId1, ProcessStatus.PAUSED)
                await tx.wait()

                const processData1 = await contractInstance.get(processId1)
                expect(processData1.mode).to.eq(ProcessMode.make({ scheduled: true }))
                expect(processData1.envelopeType).to.eq(ProcessEnvelopeType.make())
                expect(processData1.entityAddress).to.eq(entityAccount.address)
                expect(processData1.metadata).to.eq(DEFAULT_METADATA_CONTENT_HASHED_URI)
                expect(processData1.status).to.eq(ProcessStatus.PAUSED, "The process should now be paused")
            })

            it("should emit an event", async () => {
                const processId1 = await contractInstance.getProcessId(entityAccount.address, 0)

                // one is already created by the builder

                const result: { entityAddress: string, processId: string, newStatus: string } = await new Promise((resolve, reject) => {
                    contractInstance.on("StatusUpdated", (entityAddress: string, processId: string, newStatus: string) => {
                        resolve({ entityAddress, processId, newStatus })
                    })
                    contractInstance.setStatus(processId1, ProcessStatus.PAUSED).then(tx => tx.wait()).catch(reject)
                })

                expect(result).to.be.ok
                expect(result.entityAddress).to.equal(entityAccount.address)
                expect(result.processId).to.equal(processId1)
                expect(result.newStatus).to.equal(ProcessStatus.PAUSED)
            }).timeout(7000)
        })

        describe("processes should reopen", () => {
            it("if not canceled", async () => {
                const processId1 = await contractInstance.getProcessId(entityAccount.address, 0)

                // one is already created by the builder

                // Canceled by the creator
                contractInstance = contractInstance.connect(entityAccount.wallet) as any
                tx = await contractInstance.setStatus(processId1, ProcessStatus.CANCELED)
                await tx.wait()

                const processData1 = await contractInstance.get(processId1)
                expect(processData1.mode).to.eq(ProcessMode.make({ scheduled: true }))
                expect(processData1.envelopeType).to.eq(ProcessEnvelopeType.make())
                expect(processData1.entityAddress).to.eq(entityAccount.address)
                expect(processData1.metadata).to.eq(DEFAULT_METADATA_CONTENT_HASHED_URI)
                expect(processData1.status).to.eq(ProcessStatus.CANCELED, "The process should now be canceled")

                // Try to reopen
                try {
                    contractInstance = contractInstance.connect(entityAccount.wallet) as any
                    tx = await contractInstance.setStatus(processId1, 0)
                    await tx.wait()
                    throw new Error("The transaction should have thrown an error but didn't")
                }
                catch (err) {
                    expect(err.message).to.match(/revert/, "The transaction threw an unexpected error:\n" + err.message)
                }

                // Nothing else should have changed
                const processData2 = await contractInstance.get(processId1)

                expect(processData2.entityAddress).to.eq(entityAccount.address)
                expect(processData2.metadata).to.eq(DEFAULT_METADATA_CONTENT_HASHED_URI)
                expect(processData2.status).to.eq(ProcessStatus.CANCELED, "The process should be canceled")
            })

            it("if not ended", async () => {
                const processId1 = await contractInstance.getProcessId(entityAccount.address, 0)

                // one is already created by the builder

                // Ended by the creator
                contractInstance = contractInstance.connect(entityAccount.wallet) as any
                tx = await contractInstance.setStatus(processId1, 1)
                await tx.wait()

                const processData1 = await contractInstance.get(processId1)
                expect(processData1.mode).to.eq(ProcessMode.make({ scheduled: true }))
                expect(processData1.envelopeType).to.eq(ProcessEnvelopeType.make())
                expect(processData1.entityAddress).to.eq(entityAccount.address)
                expect(processData1.metadata).to.eq(DEFAULT_METADATA_CONTENT_HASHED_URI)
                expect(processData1.status).to.eq(ProcessStatus.ENDED, "The process should now be ended")

                // Try to reopen
                try {
                    contractInstance = contractInstance.connect(entityAccount.wallet) as any
                    tx = await contractInstance.setStatus(processId1, 0)
                    await tx.wait()
                    throw new Error("The transaction should have thrown an error but didn't")
                }
                catch (err) {
                    expect(err.message).to.match(/revert/, "The transaction threw an unexpected error:\n" + err.message)
                }

                // Nothing else should have changed
                const processData2 = await contractInstance.get(processId1)
                expect(processData2.entityAddress).to.eq(entityAccount.address)
                expect(processData2.metadata).to.eq(DEFAULT_METADATA_CONTENT_HASHED_URI)
                expect(processData2.status).to.eq(ProcessStatus.ENDED, "The process should be ended")
            })

            it("if not already open", async () => {
                const processId1 = await contractInstance.getProcessId(entityAccount.address, 0)

                // one is already created by the builder

                // Try to reopen
                try {
                    contractInstance = contractInstance.connect(entityAccount.wallet) as any
                    tx = await contractInstance.setStatus(processId1, 0)
                    await tx.wait()
                    throw new Error("The transaction should have thrown an error but didn't")
                }
                catch (err) {
                    expect(err.message).to.match(/revert/, "The transaction threw an unexpected error:\n" + err.message)
                }

                // Nothing else should have changed
                const processData2 = await contractInstance.get(processId1)
                expect(processData2.entityAddress).to.eq(entityAccount.address)
                expect(processData2.metadata).to.eq(DEFAULT_METADATA_CONTENT_HASHED_URI)
                expect(processData2.status).to.eq(ProcessStatus.OPEN, "The process should be open")
            })

            it("if paused", async () => {
                const processId1 = await contractInstance.getProcessId(entityAccount.address, 0)

                // one is already created by the builder

                // Paused by the creator
                contractInstance = contractInstance.connect(entityAccount.wallet) as any
                tx = await contractInstance.setStatus(processId1, ProcessStatus.PAUSED)
                await tx.wait()

                const processData1 = await contractInstance.get(processId1)
                expect(processData1.mode).to.eq(ProcessMode.make({ scheduled: true }))
                expect(processData1.envelopeType).to.eq(ProcessEnvelopeType.make())
                expect(processData1.entityAddress).to.eq(entityAccount.address)
                expect(processData1.metadata).to.eq(DEFAULT_METADATA_CONTENT_HASHED_URI)
                expect(processData1.status).to.eq(ProcessStatus.PAUSED, "The process should now be canceled")

                // Open by the creator
                contractInstance = contractInstance.connect(entityAccount.wallet) as any
                tx = await contractInstance.setStatus(processId1, 0)
                await tx.wait()

                const processData2 = await contractInstance.get(processId1)
                expect(processData2.mode).to.eq(ProcessMode.make({ scheduled: true }))
                expect(processData2.envelopeType).to.eq(ProcessEnvelopeType.make())
                expect(processData2.entityAddress).to.eq(entityAccount.address)
                expect(processData2.metadata).to.eq(DEFAULT_METADATA_CONTENT_HASHED_URI)
                expect(processData2.status).to.eq(ProcessStatus.OPEN, "The process should now be open")
            })
        })
    })

    describe("Process Results", () => {
        const results = '{"results":{"A":1234,"B":2345,"C":3456}}'

        it("should be accepted when the sender is a registered oracle", async () => {
            const processId = await contractInstance.getProcessId(entityAccount.address, 0)

            // One is already created by the builder

            // Attempt to publish the results by someone else
            try {
                contractInstance = contractInstance.connect(randomAccount1.wallet) as any
                tx = await contractInstance.setResults(processId, results)
                throw new Error("The transaction should have thrown an error but didn't")
            }
            catch (err) {
                expect(err.message).to.match(/revert/, "The transaction threw an unexpected error:\n" + err.message)
            }

            // Get results
            const result2 = await contractInstance.getResults(processId)
            expect(result2).to.eq("", "There should be no results")

            // Register an oracle
            contractInstance = contractInstance.connect(deployAccount.wallet) as any
            tx = await contractInstance.addOracle(authorizedOracleAccount1.address)
            await tx.wait()

            // Publish the results
            contractInstance = contractInstance.connect(authorizedOracleAccount1.wallet) as any
            tx = await contractInstance.setResults(processId, results)

            // Get results
            const result4 = await contractInstance.getResults(processId)
            expect(result4).to.eq(results, "The results should match")
        }).timeout(6000)

        it("should be accepted when the processId exists", async () => {
            const nonExistingProcessId1 = "0x0123456789012345678901234567890123456789012345678901234567890123"
            const nonExistingProcessId2 = "0x1234567890123456789012345678901234567890123456789012345678901234"

            // Register an oracle
            contractInstance = contractInstance.connect(deployAccount.wallet) as any
            tx = await contractInstance.addOracle(authorizedOracleAccount1.address)
            await tx.wait()

            try {
                // Try to publish
                contractInstance = contractInstance.connect(authorizedOracleAccount1.wallet) as any
                tx = await contractInstance.setResults(nonExistingProcessId1, results)
                await tx.wait()
                throw new Error("The transaction should have thrown an error but didn't")
            }
            catch (err) {
                expect(err.message).to.match(/revert/, "The transaction threw an unexpected error:\n" + err.message)
            }

            try {
                // Try to publish
                contractInstance = contractInstance.connect(authorizedOracleAccount1.wallet) as any
                tx = await contractInstance.setResults(nonExistingProcessId2, results)
                await tx.wait()
                throw new Error("The transaction should have thrown an error but didn't")
            }
            catch (err) {
                expect(err.message).to.match(/revert/, "The transaction threw an unexpected error:\n" + err.message)
            }
        })

        it("should be accepted when the process is not canceled", async () => {
            const processId = await contractInstance.getProcessId(entityAccount.address, 0)

            // One is already created by the builder

            // Cancel the process
            tx = await contractInstance.setStatus(processId, ProcessStatus.CANCELED)
            await tx.wait()

            // Register an oracle
            contractInstance = contractInstance.connect(deployAccount.wallet) as any
            tx = await contractInstance.addOracle(authorizedOracleAccount1.address)
            await tx.wait()

            // Attempt to publish the results after canceling
            try {
                contractInstance = contractInstance.connect(authorizedOracleAccount1.wallet) as any
                tx = await contractInstance.setResults(processId, results)
                throw new Error("The transaction should have thrown an error but didn't")
            }
            catch (err) {
                expect(err.message).to.match(/revert/, "The transaction threw an unexpected error:\n" + err.message)
            }

            // Get results
            const result4 = await contractInstance.getResults(processId)
            expect(result4).to.eq("", "There should be no results")
        }).timeout(5000)

        it("should retrieve the submited results", async () => {
            const processId = await contractInstance.getProcessId(entityAccount.address, 0)

            // One is already created by the builder

            // Register an oracle
            contractInstance = contractInstance.connect(deployAccount.wallet) as any
            tx = await contractInstance.addOracle(authorizedOracleAccount1.address)
            await tx.wait()

            // Publish the results
            contractInstance = contractInstance.connect(authorizedOracleAccount1.wallet) as any
            tx = await contractInstance.setResults(processId, results)

            // Get results
            const result3 = await contractInstance.getResults(processId)
            expect(result3).to.eq(results, "The results should match")

        }).timeout(5000)

        it("should prevent publishing twice", async () => {
            const originalResults = "SOMETHING_DIFFERENT_HERE"
            const processId = await contractInstance.getProcessId(entityAccount.address, 0)

            // One is already created by the builder

            // Register an oracle
            contractInstance = contractInstance.connect(deployAccount.wallet) as any
            tx = await contractInstance.addOracle(authorizedOracleAccount1.address)
            await tx.wait()

            // publish results
            contractInstance = contractInstance.connect(authorizedOracleAccount1.wallet) as any
            tx = await contractInstance.setResults(processId, originalResults)

            // Get results
            const result3 = await contractInstance.getResults(processId)
            expect(result3).to.eq(originalResults, "The results should match the invalid one")

            // Try update the results
            try {
                contractInstance = contractInstance.connect(authorizedOracleAccount1.wallet) as any
                tx = await contractInstance.setResults(processId, results)
                throw new Error("The transaction should have thrown an error but didn't")
            }
            catch (err) {
                expect(err.message).to.match(/revert/, "The transaction threw an unexpected error:\n" + err.message)
            }

            // Get results
            const result4 = await contractInstance.getResults(processId)
            expect(result4).to.eq(originalResults, "The results should stay the same")
        }).timeout(5000)

        it("should emit an event", async () => {
            const processId1 = await contractInstance.getProcessId(entityAccount.address, 0)

            // Register an oracle
            contractInstance = contractInstance.connect(deployAccount.wallet) as any
            tx = await contractInstance.addOracle(authorizedOracleAccount1.address)
            await tx.wait()

            // one is already created by the builder

            contractInstance = contractInstance.connect(authorizedOracleAccount1.wallet) as any
            const result: { processId: string, results: string } = await new Promise((resolve, reject) => {
                contractInstance.on("ResultsPublished", (processId: string, results: string) => {
                    resolve({ processId, results })
                })
                contractInstance.setResults(processId1, results).then(tx => tx.wait()).catch(reject)
            })

            expect(result).to.be.ok
            expect(result.processId).to.equal(processId1)
            expect(result.results).to.equal(results)
        }).timeout(5000)
    })

    describe("Dynamic Census", () => {
        it("Should keep the census read-only by default")

        it("Should allow to update the census in dynamic census mode")

        it("Should emit an event")
    })

    describe("Dynamic Metadata", () => {
        it("Should keep the metadata read-only by default")

        it("Should keep the metadata read-only if questionIndex > 0")

        it("The metadata can be updated in dynamic metadata mode")

        it("Should emit an event")
    })

    describe("Multi Envelope", () => {
        it("The question index should be read-only by default")

        it("The question index can be incremented in multi-envelope mode")

        it("Should fail if questionCount is zero")

        it("Should end a process after the last question has been incremented")

        it("Should emit an event when the current question is incremented")

        it("Should emit an event when question increment ends the process")
    })

    // describe("should handle multi envelope processes", () => {
    //     it("should create multi envelope processes", async () => {
    //         const processId1 = await contractInstance.getProcessId(entityAccount.address, 0)
    //         // Create
    //         const result1 = await contractInstance.create(ProcessMode.ASSEMBLY, ProcessEnvelopeType.REALTIME_POLL, metadata, censusMerkleRoot, censusMerkleTree, 0, 1000, questionCount)
    //         await tx.wait()
    //         assert.equal(result1.events.ProcessCreated.returnValues.processId, processId1)
    //     })

    //     it("should have a default questionIndex", async () => {
    //         const processId1 = await contractInstance.getProcessId(entityAccount.address, 0)
    //         const questionCount = 100
    //         // Create
    //         const result1 = await contractInstance.create(ProcessMode.ASSEMBLY, ProcessEnvelopeType.REALTIME_POLL, DEFAULT_METADATA_CONTENT_HASHED_URI, DEFAULT_MERKLE_ROOT, DEFAULT_MERKLE_TREE_CONTENT_HASHED_URI, DEFAULT_START_BLOCK, DEFAULT_NUMBER_OF_BLOCKS, DEFAULT_QUESTION_COUNT)
    //         await tx.wait()
    //         assert.equal(result1.events.ProcessCreated.returnValues.processId, processId1)

    //         const indexResult = await contractInstance.getQuestionStatus(processId1)
    //         assert.equal(indexResult.questionIndex, 0, "The question index should be 0 by default")
    //         assert.equal(indexResult.questionCount, questionCount, "The question count should match")
    //     })

    //     it("should increment questionIndex", async () => {
    //         const processId1 = await contractInstance.getProcessId(entityAccount.address, 0)
    //         const questionCount = 100
    //         // Create
    //         const result1 = await contractInstance.create(ProcessMode.ASSEMBLY, ProcessEnvelopeType.REALTIME_POLL, DEFAULT_METADATA_CONTENT_HASHED_URI, DEFAULT_MERKLE_ROOT, DEFAULT_MERKLE_TREE_CONTENT_HASHED_URI, DEFAULT_START_BLOCK, DEFAULT_NUMBER_OF_BLOCKS, DEFAULT_QUESTION_COUNT)
    //         await tx.wait()
    //         assert.equal(result1.events.ProcessCreated.returnValues.processId, processId1)

    //         const result2 = await contractInstance.incrementQuestionIndex(processId1)
    //         await tx.wait()
    //         expect(result2).to.be.ok
    //         expect(result2.events).to.be.ok
    //         expect(result2.events.QuestionIndexIncremented).to.be.ok
    //         expect(result2.events.QuestionIndexIncremented.returnValues).to.be.ok
    //         assert.equal(result2.events.QuestionIndexIncremented.event, "QuestionIndexIncremented")
    //         assert.equal(result2.events.QuestionIndexIncremented.returnValues.processId, processId1)
    //         assert.equal(result2.events.QuestionIndexIncremented.returnValues.newIndex, 1)

    //         const indexResult1 = await contractInstance.getQuestionStatus(processId1)
    //         assert.equal(indexResult1.questionIndex, 1, "The question index should be 1")
    //         assert.equal(indexResult1.questionCount, questionCount, "The question count should match")

    //         const result3 = await contractInstance.incrementQuestionIndex(processId1)
    //         await tx.wait()
    //         expect(result3).to.be.ok
    //         expect(result3.events).to.be.ok
    //         expect(result3.events.QuestionIndexIncremented).to.be.ok
    //         expect(result3.events.QuestionIndexIncremented.returnValues).to.be.ok
    //         assert.equal(result3.events.QuestionIndexIncremented.event, "QuestionIndexIncremented")
    //         assert.equal(result3.events.QuestionIndexIncremented.returnValues.processId, processId1)
    //         assert.equal(result3.events.QuestionIndexIncremented.returnValues.newIndex, 2)

    //         const indexResult2 = await contractInstance.getQuestionStatus(processId1)
    //         assert.equal(indexResult2.questionIndex, 2, "The question index should be 2")
    //         assert.equal(indexResult2.questionCount, questionCount, "The question count should match")

    //         // Fast forward 10 times
    //         for (let i = 0; i < 10; i++) {
    //           tx =  await contractInstance.incrementQuestionIndex(processId1)
    //             await tx.wait()
    //         }

    //         const indexResult3 = await contractInstance.getQuestionStatus(processId1)
    //         assert.equal(indexResult3.questionIndex, 12, "The question index should be 12")
    //         assert.equal(indexResult3.questionCount, questionCount, "The question count should match")
    //     })
    // })

})
